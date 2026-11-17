import { TOOLS, RESOURCE, findResource } from '../tools/index.js';
import { ToolPermission, Policy } from '../../models/index.js';
import { config, riskLevel } from '../../config.js';
import { assessRisk } from '../ai/provider.js';

const BASE = { low: 10, medium: 35, high: 65, critical: 85 };

/**
 * Agent Shield gateway. Pure authority: the LLM proposes, this decides.
 * ctx: { ns, approved, taint, taintReasons, threatType, injScore, userMessage }
 * Order follows SRS 12.2: invalid -> unauthorized resource -> policy violation -> approval -> allow.
 * Fails closed on ANY internal error.
 */
export async function evaluate({ userId, toolName, args, ctx = {} }) {
  const started = performance.now();
  let risk = 0;
  const done = (decision, reason, policy, extra = {}) => {
    const score = Math.round(extra.riskScore ?? risk);
    return {
      decision, reason, policy: policy || null, riskScore: score, riskLevel: riskLevel(score),
      ai: extra.ai || null, threatType: extra.threatType || null,
      scope: { safeOnly: true }, latencyMs: Math.round(performance.now() - started),
    };
  };
  try {
    const tool = TOOLS[toolName];
    if (!tool) return done('BLOCK', 'Unknown tool — rejected by default.', 'unknown_tool', { riskScore: 90, threatType: 'UNAUTHORIZED_TOOL_USAGE' });

    const parsed = tool.schema.safeParse(args);
    if (!parsed.success)
      return done('BLOCK', 'Invalid tool arguments: ' + (parsed.error.issues[0]?.message || 'validation failed'), 'invalid_args', { riskScore: 70, threatType: 'TOOL_ARGUMENT_MANIPULATION' });
    const clean = parsed.data;

    const [perm, pols] = await Promise.all([ToolPermission.findOne({ toolName }), Policy.find()]);
    const on = (k) => pols.find((p) => p.key === k)?.enabled !== false;
    if (!perm || !perm.allowed) return done('BLOCK', 'Tool is disabled or has no permission record.', 'tool_disabled', { riskScore: 80, threatType: 'UNAUTHORIZED_TOOL_USAGE' });

    const lvl = perm.riskLevel;
    risk = BASE[lvl] ?? 85;
    if (ctx.taint) risk += 25;
    if (ctx.injScore) risk += Math.min(15, ctx.injScore * 0.15);
    if (toolName === 'transfer_money' && clean.amount >= 10000) risk += 10;
    risk = Math.min(100, risk);

    // Resource ownership (never trusts a stored permission flag alone)
    const rr = RESOURCE[toolName];
    if (rr) {
      const res = await findResource(userId, ctx.ns, rr.kind, clean[rr.arg]);
      if (!res) return done('BLOCK', `Referenced ${rr.kind} does not exist.`, 'resource_ownership', { riskScore: Math.max(risk, 70), threatType: 'TOOL_ARGUMENT_MANIPULATION' });
      if (res.owner !== 'self')
        return done('BLOCK', `${rr.kind} "${clean[rr.arg]}" belongs to another user — access denied.`, 'resource_ownership', { riskScore: Math.max(risk, 90), threatType: 'UNAUTHORIZED_RESOURCE_ACCESS' });
    }

    if (toolName === 'transfer_money' && on('transfer_limit') && clean.amount > config.transferLimit)
      return done('BLOCK', `Transfer exceeds the configured limit of ${config.transferLimit}.`, 'transfer_limit', { riskScore: Math.max(risk, 85) });

    if (ctx.taint && (lvl === 'high' || lvl === 'critical') && on('untrusted_origin_block'))
      return done('BLOCK', 'Restricted tool requested while untrusted or suspicious content is steering the agent.', 'untrusted_origin_block', {
        riskScore: Math.max(risk, 90), threatType: ctx.threatType || 'PROMPT_INJECTION',
      });

    let decision = 'ALLOW', reason = 'Authorized operation within policy.', policy = null;
    const approvalPolicyOn = toolName === 'transfer_money' ? on('transfer_approval') : toolName === 'delete_file' ? on('delete_approval') : true;
    if (perm.requiresApproval && !ctx.approved && approvalPolicyOn) {
      decision = 'REQUIRE_APPROVAL';
      reason = `${toolName} is a restricted operation and needs explicit human approval.`;
      policy = toolName === 'transfer_money' ? 'transfer_approval' : toolName === 'delete_file' ? 'delete_approval' : 'tool_requires_approval';
    }

    // AI-assisted assessment: supporting evidence only — can escalate ALLOW, can never relax a decision
    let ai = null;
    if (!ctx.approved && decision !== 'BLOCK' && (ctx.taint || risk >= config.thresholds.high) && on('ai_risk_assessment')) {
      ai = await assessRisk({ tool: toolName, args: clean, riskLevel: lvl, taint: !!ctx.taint, reasons: ctx.taintReasons || [], userMessage: ctx.userMessage || '', localScore: risk });
      risk = Math.max(risk, ai.riskScore);
      if (decision === 'ALLOW' && ai.riskScore >= config.thresholds.high) {
        decision = 'REQUIRE_APPROVAL';
        reason = 'Contextual risk assessment flagged this call: ' + ai.reason;
        policy = 'ai_risk_assessment';
      }
    }
    return done(decision, reason, policy, { riskScore: risk, ai, threatType: ai?.threatType !== 'NONE' ? ai?.threatType : ctx.taint ? 'PROMPT_INJECTION' : null });
  } catch (e) {
    console.error('gateway error (failing closed):', e.message);
    return done('BLOCK', 'Security engine error — failing closed.', 'fail_closed', { riskScore: 100 });
  }
}
