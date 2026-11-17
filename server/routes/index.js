import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, AgentSession, ToolPermission, Policy, SecurityEvent, ApprovalRequest, SimResult } from '../models/index.js';
import { requireAuth, requireAdmin, setAuthCookie } from '../middleware/auth.js';
import { asyncH } from '../utils.js';
import { TOOLS, seedUser, seedNs } from '../services/tools/index.js';
import { runAgent } from '../services/agent/agent.js';
import { evaluate } from '../services/security/gateway.js';
import { approve, reject, expireStale } from '../services/security/approvals.js';
import { SCENARIOS } from '../services/simulator/scenarios.js';
import { runScenario, compare } from '../services/simulator/simulator.js';
import { providerInfo } from '../services/ai/provider.js';
import { config } from '../config.js';

const r = Router();
const parse = (schema, data) => {
  const p = schema.safeParse(data);
  if (!p.success) throw Object.assign(new Error(p.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')), { status: 400 });
  return p.data;
};
const isId = (id) => mongoose.isValidObjectId(id);
const bad = (res, msg = 'Invalid id') => res.status(400).json({ error: msg });

/* ---------------- Auth (FR-01) ---------------- */
r.post('/auth/register', asyncH(async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().email(), password: z.string().min(8).max(100) }), req.body);
  if (await User.findOne({ email: b.email.toLowerCase() })) return res.status(409).json({ error: 'An account with this email already exists' });
  const role = (await User.countDocuments()) === 0 ? 'admin' : 'researcher';
  const u = await User.create({ name: b.name, email: b.email, password: await bcrypt.hash(b.password, 12), role });
  await seedUser(u._id);
  setAuthCookie(res, u);
  res.status(201).json({ user: { id: u._id, name: u.name, email: u.email, role: u.role } });
}));
r.post('/auth/login', asyncH(async (req, res) => {
  const b = parse(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(100) }), req.body);
  const u = await User.findOne({ email: b.email.toLowerCase() });
  if (!u || !(await bcrypt.compare(b.password, u.password))) return res.status(401).json({ error: 'Incorrect email or password' });
  setAuthCookie(res, u);
  res.json({ user: { id: u._id, name: u.name, email: u.email, role: u.role } });
}));
r.post('/auth/logout', (req, res) => { res.clearCookie('as_token'); res.json({ ok: true }); });
r.get('/auth/me', requireAuth, (req, res) => res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } }));

r.use(requireAuth);

/* ---------------- Agent (FR-02) ---------------- */
r.post('/agent/chat', asyncH(async (req, res) => {
  const b = parse(z.object({ sessionId: z.string().optional(), message: z.string().trim().min(1).max(2000), mode: z.enum(['protected', 'unprotected']).default('protected') }), req.body);
  let session;
  if (b.sessionId) {
    if (!isId(b.sessionId)) return bad(res);
    session = await AgentSession.findOne({ _id: b.sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.mode !== b.mode) { session.mode = b.mode; await session.save(); }
  } else {
    session = await AgentSession.create({ userId: req.user._id, sessionName: b.message.slice(0, 40), mode: b.mode });
  }
  const result = await runAgent({ user: req.user, session, message: b.message, mode: b.mode });
  res.json({ sessionId: session._id, ...result });
}));
r.get('/agent/sessions', asyncH(async (req, res) => {
  const s = await AgentSession.find({ userId: req.user._id, sessionName: { $not: /^Sim:/ } }).select('sessionName mode updatedAt').sort({ updatedAt: -1 }).limit(50);
  res.json({ sessions: s });
}));
r.get('/agent/sessions/:id', asyncH(async (req, res) => {
  if (!isId(req.params.id)) return bad(res);
  const s = await AgentSession.findOne({ _id: req.params.id, userId: req.user._id });
  if (!s) return res.status(404).json({ error: 'Session not found' });
  res.json({ session: s });
}));
r.delete('/agent/sessions/:id', asyncH(async (req, res) => {
  if (!isId(req.params.id)) return bad(res);
  await AgentSession.deleteOne({ _id: req.params.id, userId: req.user._id });
  res.json({ ok: true });
}));

/* ---------------- Security (FR-05..FR-10) ---------------- */
// Dry-run only: returns the gateway decision, never executes anything
r.post('/security/evaluate', asyncH(async (req, res) => {
  const b = parse(z.object({ toolName: z.string().max(60), args: z.record(z.any()).default({}), untrustedContext: z.boolean().default(false), userMessage: z.string().max(2000).optional() }), req.body);
  const d = await evaluate({ userId: req.user._id, toolName: b.toolName, args: b.args, ctx: { ns: 'protected', taint: b.untrustedContext, taintReasons: b.untrustedContext ? ['client-declared untrusted context'] : [], userMessage: b.userMessage } });
  res.json({ dryRun: true, ...d });
}));
r.get('/security/status', (req, res) => res.json({ provider: providerInfo(), failClosed: true, thresholds: config.thresholds, role: req.user.role }));

r.get('/security/events', asyncH(async (req, res) => {
  const q = parse(z.object({
    q: z.string().max(80).optional(), decision: z.string().max(30).optional(), tool: z.string().max(40).optional(), riskLevel: z.string().max(12).optional(),
    eventType: z.string().max(40).optional(), from: z.string().optional(), to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(200).default(50),
  }), req.query);
  const f = { userId: req.user._id };
  if (q.decision) f.decision = q.decision;
  if (q.tool) f.toolName = q.tool;
  if (q.riskLevel) f.riskLevel = q.riskLevel;
  if (q.eventType) f.eventType = q.eventType;
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  if (q.q) { const re = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ reason: re }, { eventType: re }, { toolName: re }, { threatType: re }]; }
  const [events, total] = await Promise.all([SecurityEvent.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit), SecurityEvent.countDocuments(f)]);
  res.json({ events, total, page: q.page });
}));

r.get('/security/analytics', asyncH(async (req, res) => {
  await expireStale(req.user._id);
  const m = { userId: new mongoose.Types.ObjectId(req.user._id) };
  const decisionEvents = { ...m, eventType: { $in: ['TOOL_CALL_ALLOWED', 'TOOL_CALL_BLOCKED', 'APPROVAL_REQUESTED'] } };
  const count = (extra) => SecurityEvent.countDocuments({ ...m, ...extra });
  const [totalRequests, toolAttempts, allowed, blocked, injections, highRisk, pending, byType, byThreat, risk, overTime, recent] = await Promise.all([
    count({ eventType: 'USER_MESSAGE' }), count({ eventType: 'TOOL_CALL_PROPOSED' }), count({ eventType: 'TOOL_CALL_ALLOWED' }),
    count({ eventType: 'TOOL_CALL_BLOCKED' }), count({ eventType: 'PROMPT_INJECTION_DETECTED' }),
    SecurityEvent.countDocuments({ ...decisionEvents, riskScore: { $gte: 60 } }),
    ApprovalRequest.countDocuments({ userId: req.user._id, status: 'pending' }),
    SecurityEvent.aggregate([{ $match: m }, { $group: { _id: '$eventType', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    SecurityEvent.aggregate([{ $match: { ...m, threatType: { $nin: [null, 'NONE'] }, eventType: { $in: ['PROMPT_INJECTION_DETECTED', 'TOOL_CALL_BLOCKED', 'APPROVAL_REQUESTED'] } } }, { $group: { _id: '$threatType', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    SecurityEvent.aggregate([{ $match: { ...decisionEvents, riskScore: { $ne: null } } }, { $bucket: { groupBy: '$riskScore', boundaries: [0, 30, 60, 80, 101], default: 'x', output: { n: { $sum: 1 } } } }]),
    SecurityEvent.aggregate([
      { $match: { ...m, eventType: { $in: ['TOOL_CALL_ALLOWED', 'TOOL_CALL_BLOCKED', 'APPROVAL_REQUESTED', 'PROMPT_INJECTION_DETECTED'] }, createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } } },
      { $group: { _id: { $dateToString: { format: '%m-%d %H:00', date: '$createdAt' } }, allowed: { $sum: { $cond: [{ $eq: ['$eventType', 'TOOL_CALL_ALLOWED'] }, 1, 0] } }, blocked: { $sum: { $cond: [{ $eq: ['$eventType', 'TOOL_CALL_BLOCKED'] }, 1, 0] } }, approvals: { $sum: { $cond: [{ $eq: ['$eventType', 'APPROVAL_REQUESTED'] }, 1, 0] } }, attacks: { $sum: { $cond: [{ $eq: ['$eventType', 'PROMPT_INJECTION_DETECTED'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    SecurityEvent.find({ ...m, eventType: { $ne: 'USER_MESSAGE' } }).sort({ createdAt: -1 }).limit(8),
  ]);
  const labels = { 0: 'Low (0-29)', 30: 'Medium (30-59)', 60: 'High (60-79)', 80: 'Critical (80-100)' };
  res.json({
    stats: { totalRequests, toolAttempts, allowed, blocked, pending, injections, highRisk },
    byType: byType.map((x) => ({ name: x._id, value: x.n })),
    byThreat: byThreat.map((x) => ({ name: x._id, value: x.n })),
    riskDist: [0, 30, 60, 80].map((b) => ({ name: labels[b], value: risk.find((x) => x._id === b)?.n || 0 })),
    overTime: overTime.map((x) => ({ time: x._id, ...x, _id: undefined })),
    allowedVsBlocked: [{ name: 'Allowed', value: allowed }, { name: 'Blocked', value: blocked }, { name: 'Approval', value: pending }],
    recent,
  });
}));

r.get('/security/policies', asyncH(async (req, res) => res.json({ policies: await Policy.find().sort({ mandatory: -1, key: 1 }) })));
r.put('/security/policies/:id', requireAdmin, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return bad(res);
  const b = parse(z.object({ enabled: z.boolean() }), req.body);
  const p = await Policy.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Policy not found' });
  if (p.mandatory) return res.status(400).json({ error: 'Mandatory baseline policies cannot be disabled' });
  p.enabled = b.enabled; await p.save();
  res.json({ policy: p });
}));

/* ---------------- Tools (FR-03) ---------------- */
r.get('/tools', asyncH(async (req, res) => {
  const perms = await ToolPermission.find();
  res.json({ tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, params: t.params, risk: t.risk, permission: t.permission, enabled: perms.find((p) => p.toolName === name)?.allowed ?? false })) });
}));
r.get('/tools/permissions', asyncH(async (req, res) => res.json({ permissions: await ToolPermission.find().sort({ toolName: 1 }) })));
r.put('/tools/permissions/:id', requireAdmin, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return bad(res);
  const b = parse(z.object({ allowed: z.boolean().optional(), requiresApproval: z.boolean().optional() }), req.body);
  const p = await ToolPermission.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Permission not found' });
  if (b.requiresApproval === false && ['critical', 'high'].includes(p.riskLevel)) return res.status(400).json({ error: 'Approval cannot be removed from high or critical tools (mandatory baseline)' });
  if (b.allowed !== undefined) p.allowed = b.allowed;
  if (b.requiresApproval !== undefined) p.requiresApproval = b.requiresApproval;
  await p.save();
  res.json({ permission: p });
}));

/* ---------------- Approvals (FR-08) ---------------- */
r.get('/approvals', asyncH(async (req, res) => {
  await expireStale(req.user._id);
  const f = { userId: req.user._id, ...(req.query.all ? {} : { status: 'pending' }) };
  res.json({ approvals: await ApprovalRequest.find(f).sort({ createdAt: -1 }).limit(100), requester: req.user.name });
}));
r.post('/approvals/:id/approve', asyncH(async (req, res) => { if (!isId(req.params.id)) return bad(res); res.json(await approve(req.user._id, req.params.id)); }));
r.post('/approvals/:id/reject', asyncH(async (req, res) => { if (!isId(req.params.id)) return bad(res); res.json(await reject(req.user._id, req.params.id)); }));

/* ---------------- Simulator (FR-11, FR-12) ---------------- */
r.get('/simulator/scenarios', (req, res) => res.json({ scenarios: SCENARIOS }));
r.post('/simulator/run', asyncH(async (req, res) => {
  const b = parse(z.object({ scenarioId: z.string().max(40), mode: z.enum(['protected', 'unprotected']) }), req.body);
  res.json({ result: await runScenario(req.user, b.scenarioId, b.mode) });
}));
r.post('/simulator/compare', asyncH(async (req, res) => {
  const b = parse(z.object({ scenarioId: z.string().max(40) }), req.body);
  res.json({ result: await compare(req.user, b.scenarioId) });
}));
r.get('/simulator/results/:id', asyncH(async (req, res) => {
  if (!isId(req.params.id)) return bad(res);
  const x = await SimResult.findOne({ _id: req.params.id, userId: req.user._id });
  if (!x) return res.status(404).json({ error: 'Result not found' });
  res.json({ result: x });
}));
r.post('/simulator/reset', asyncH(async (req, res) => { await seedUser(req.user._id); res.json({ ok: true }); }));

export default r;
