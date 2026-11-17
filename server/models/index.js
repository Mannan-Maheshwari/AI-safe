import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const oid = Schema.Types.ObjectId;

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'researcher'], default: 'researcher' },
}, { timestamps: true }));

export const AgentSession = model('AgentSession', new Schema({
  userId: { type: oid, index: true, required: true },
  sessionName: String,
  mode: { type: String, enum: ['protected', 'unprotected'], default: 'protected' },
  status: { type: String, default: 'active' },
  turns: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true }));

export const ToolPermission = model('ToolPermission', new Schema({
  toolName: { type: String, unique: true },
  allowed: { type: Boolean, default: true },
  requiresApproval: { type: Boolean, default: false },
  riskLevel: String,
  permission: String,
  description: String,
}));

export const Policy = model('Policy', new Schema({
  key: { type: String, unique: true },
  name: String,
  description: String,
  tool: String,
  action: String,
  enabled: { type: Boolean, default: true },
  mandatory: { type: Boolean, default: false },
}));

const evt = new Schema({
  userId: { type: oid, index: true },
  sessionId: oid,
  mode: String,
  eventType: { type: String, index: true },
  toolName: String,
  decision: String,
  riskScore: Number,
  riskLevel: String,
  threatType: String,
  reason: String,
  status: String,
  details: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
evt.index({ userId: 1, createdAt: -1 });
export const SecurityEvent = model('SecurityEvent', evt);

export const ApprovalRequest = model('ApprovalRequest', new Schema({
  userId: { type: oid, index: true },
  sessionId: oid,
  ns: String,
  toolName: String,
  arguments: Schema.Types.Mixed,
  argsHash: String,
  riskScore: Number,
  riskLevel: String,
  reason: String,
  status: { type: String, default: 'pending' }, // pending|executing|approved|rejected|expired|invalid|blocked
  resultSummary: String,
  expiresAt: Date,
  decidedAt: Date,
}, { timestamps: true }));

const sim = new Schema({
  userId: oid, ns: String, kind: String, key: String,
  owner: { type: String, enum: ['self', 'other'], default: 'self' },
  confidential: { type: Boolean, default: false },
  data: Schema.Types.Mixed,
});
sim.index({ userId: 1, ns: 1, kind: 1, key: 1 }, { unique: true });
export const SimulatedData = model('SimulatedData', sim);

export const SimResult = model('SimResult', new Schema({
  userId: { type: oid, index: true },
  kind: String,
  scenarioId: String,
  runs: [Schema.Types.Mixed],
  metrics: Schema.Types.Mixed,
}, { timestamps: true }));
