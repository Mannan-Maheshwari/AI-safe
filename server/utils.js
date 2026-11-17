import crypto from 'crypto';

export const stable = (v) =>
  v && typeof v === 'object'
    ? Array.isArray(v)
      ? '[' + v.map(stable).join(',') + ']'
      : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
    : JSON.stringify(v);

// Integrity hash: any change in tool or arguments invalidates an approval (FR-08)
export const hashCall = (tool, args) => crypto.createHash('sha256').update(tool + '|' + stable(args)).digest('hex');

const SENSITIVE = /pass(word)?|token|secret|api[-_]?key|authorization|cookie/i;
export function redact(v, depth = 0) {
  if (v == null || depth > 6) return v;
  if (typeof v === 'string') return (v.length > 900 ? v.slice(0, 900) + '…' : v).replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]');
  if (Array.isArray(v)) return v.map((x) => redact(x, depth + 1));
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = SENSITIVE.test(k) ? '[REDACTED]' : redact(x, depth + 1);
    return o;
  }
  return v;
}

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
