import { Policy, ToolPermission } from '../../models/index.js';
import { TOOLS } from '../tools/index.js';

const POLICIES = [
  { key: 'unknown_tool', name: 'Reject unknown tools', description: 'Any tool not in the registry is blocked.', tool: '*', action: 'BLOCK', mandatory: true },
  { key: 'invalid_args', name: 'Validate tool arguments', description: 'Arguments are validated with strict Zod schemas; malformed calls are blocked.', tool: '*', action: 'BLOCK', mandatory: true },
  { key: 'tool_disabled', name: 'Respect tool permissions', description: 'Disabled tools or tools without a permission record are blocked.', tool: '*', action: 'BLOCK', mandatory: true },
  { key: 'resource_ownership', name: 'Resource ownership check', description: 'Emails, files and accounts of other users can never be accessed or modified.', tool: 'read_email, transfer_money, delete_file', action: 'BLOCK', mandatory: true },
  { key: 'untrusted_origin_block', name: 'Block restricted tools after injection', description: 'High/critical tools are blocked when untrusted or suspicious content has influenced the agent.', tool: 'transfer_money, delete_file', action: 'BLOCK' },
  { key: 'transfer_limit', name: 'Transfer limit', description: 'Block transfers above the configured maximum amount.', tool: 'transfer_money', action: 'BLOCK' },
  { key: 'transfer_approval', name: 'Financial transfers need approval', description: 'Every simulated transfer requires explicit human approval.', tool: 'transfer_money', action: 'REQUIRE_APPROVAL' },
  { key: 'delete_approval', name: 'File deletion needs approval', description: 'Deleting a workspace file requires explicit human approval.', tool: 'delete_file', action: 'REQUIRE_APPROVAL' },
  { key: 'ai_risk_assessment', name: 'AI-assisted risk assessment', description: 'Suspicious calls get a contextual risk score that may escalate ALLOW to REQUIRE_APPROVAL (never the reverse).', tool: '*', action: 'ESCALATE' },
];

export async function seedDefaults() {
  for (const p of POLICIES)
    await Policy.updateOne({ key: p.key }, { $setOnInsert: { enabled: true, mandatory: false, ...p } }, { upsert: true });
  for (const [toolName, t] of Object.entries(TOOLS))
    await ToolPermission.updateOne(
      { toolName },
      { $setOnInsert: { toolName, allowed: true, requiresApproval: t.requiresApproval, riskLevel: t.risk, permission: t.permission, description: t.description } },
      { upsert: true });
}
