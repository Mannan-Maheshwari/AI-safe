import { ApprovalRequest } from '../../models/index.js';
import { evaluate } from './gateway.js';
import { executeTool } from '../tools/index.js';
import { logEvent } from './events.js';
import { hashCall } from '../../utils.js';

const fail = (status, msg) => Object.assign(new Error(msg), { status });

export async function expireStale(userId) {
  await ApprovalRequest.updateMany({ userId, status: 'pending', expiresAt: { $lt: new Date() } }, { status: 'expired' });
}

export async function approve(userId, id) {
  await expireStale(userId);
  const ar = await ApprovalRequest.findOne({ _id: id, userId });
  if (!ar) throw fail(404, 'Approval request not found');
  const log = (eventType, extra = {}) => logEvent({ userId, sessionId: ar.sessionId, mode: 'protected', toolName: ar.toolName, eventType, riskScore: ar.riskScore, riskLevel: ar.riskLevel, details: { approvalId: ar._id, args: ar.arguments }, ...extra });
  if (ar.status === 'expired') throw fail(410, 'This approval request has expired');
  if (ar.status !== 'pending') throw fail(409, `Request is already ${ar.status}`);
  if (hashCall(ar.toolName, ar.arguments) !== ar.argsHash) {
    await ApprovalRequest.updateOne({ _id: ar._id, status: 'pending' }, { status: 'invalid', decidedAt: new Date() });
    await log('APPROVAL_INTEGRITY_FAILURE', { decision: 'BLOCK', reason: 'Arguments changed after approval was requested', status: 'invalid' });
    throw fail(409, 'Request arguments were modified — a new approval is required');
  }
  // Atomic claim: a second click or replay cannot execute the operation twice
  const claimed = await ApprovalRequest.findOneAndUpdate({ _id: ar._id, status: 'pending' }, { status: 'executing' });
  if (!claimed) throw fail(409, 'Request is already being processed');

  const d = await evaluate({ userId, toolName: ar.toolName, args: ar.arguments, ctx: { ns: ar.ns, approved: true } });
  if (d.decision === 'BLOCK') {
    await ApprovalRequest.updateOne({ _id: ar._id }, { status: 'blocked', decidedAt: new Date(), resultSummary: d.reason });
    await log('TOOL_CALL_BLOCKED', { decision: 'BLOCK', reason: 'Re-validation failed at execution time: ' + d.reason, status: 'blocked' });
    throw fail(403, 'Blocked on re-validation: ' + d.reason);
  }
  await log('APPROVAL_APPROVED', { decision: 'ALLOW', reason: 'Approved by authenticated user', status: 'approved' });
  const exec = await executeTool(ar.toolName, ar.arguments, { userId, ns: ar.ns, approved: true, scope: { safeOnly: true } });
  const summary = exec.ok ? JSON.stringify(exec.output) : exec.error;
  await ApprovalRequest.updateOne({ _id: ar._id }, { status: 'approved', decidedAt: new Date(), resultSummary: summary });
  await log('TOOL_EXECUTED', { decision: 'ALLOW', reason: exec.ok ? 'Executed after human approval' : exec.error, status: exec.ok ? 'executed' : 'failed' });
  return { ok: exec.ok, result: exec.ok ? exec.output : null, error: exec.error };
}

export async function reject(userId, id) {
  const ar = await ApprovalRequest.findOneAndUpdate({ _id: id, userId, status: 'pending' }, { status: 'rejected', decidedAt: new Date() });
  if (!ar) throw fail(409, 'Request not found or no longer pending');
  await logEvent({ userId, sessionId: ar.sessionId, mode: 'protected', toolName: ar.toolName, eventType: 'APPROVAL_REJECTED', decision: 'BLOCK', riskScore: ar.riskScore, riskLevel: ar.riskLevel, reason: 'Rejected by user', status: 'rejected', details: { approvalId: ar._id } });
  return { ok: true };
}
