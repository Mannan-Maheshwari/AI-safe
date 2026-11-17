import 'dotenv/config';

export const config = {
  port: process.env.PORT || 5000,
  mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-shield',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  approvalTtlMs: (Number(process.env.APPROVAL_TTL_MIN) || 15) * 60000,
  transferLimit: Number(process.env.TRANSFER_LIMIT) || 50000,
  // Configurable risk thresholds (SRS FR-07) — calibrate during testing
  thresholds: { medium: 30, high: 60, critical: 80 },
  isProd: process.env.NODE_ENV === 'production',
};

export const riskLevel = (s) =>
  s >= config.thresholds.critical ? 'CRITICAL' : s >= config.thresholds.high ? 'HIGH' : s >= config.thresholds.medium ? 'MEDIUM' : 'LOW';
