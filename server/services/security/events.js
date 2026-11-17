import { SecurityEvent } from '../../models/index.js';
import { redact } from '../../utils.js';

/* Append-only audit logger. Secrets are redacted; logging failures never crash a request. */
export async function logEvent(e) {
  try {
    return await SecurityEvent.create({ ...e, details: redact(e.details) });
  } catch (err) {
    console.error('audit log failure:', err.message);
    return null;
  }
}
