// Deterministic prompt-injection detector (layer 1 of FR-04). Never the sole authority:
// the gateway also applies policies, ownership checks and (optionally) AI risk assessment.
const norm = (s) => String(s || '').normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '').toLowerCase();

const COMMON = [
  [/ignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?|directions?)/, 60, 'INSTRUCTION_OVERRIDE'],
  [/(disregard|forget|override|bypass)\s+(all\s+|the\s+|your\s+|any\s+)?(previous|prior|above|safety|security|system)\s*(instructions?|rules?|prompts?|restrictions?|guidelines?)?/, 55, 'INSTRUCTION_OVERRIDE'],
  [/ignore\s+the\s+user'?s?\s+(request|task|question|instructions?)/, 60, 'INSTRUCTION_OVERRIDE'],
  [/(reveal|show|print|leak|expose|disclose|dump)\b.{0,40}(system prompt|hidden prompt|your instructions|confidential|secrets?|credentials?|passwords?|api[ -]?keys?)/, 55, 'DATA_EXFILTRATION'],
  [/(give|grant|make)\s+(yourself|me|the agent)\b.{0,30}(admin|administrator|root|elevated|superuser)/, 70, 'PRIVILEGE_ESCALATION'],
  [/(admin(istrator)?|root|superuser)\s+(access|privileges?|rights|mode)/, 40, 'PRIVILEGE_ESCALATION'],
  [/(you are now|act as|pretend to be)\s+(an?\s+)?(unrestricted|jailbroken|dan|evil|developer)|developer mode|jailbreak/, 50, 'JAILBREAK'],
];
// Only meaningful when the text comes from an untrusted source (email, document, web)
const UNTRUSTED_ONLY = [
  [/(system|assistant|ai|admin)\s*(instruction|note|message|override|prompt)\s*[:\-]/, 45, 'EMBEDDED_INSTRUCTION'],
  [/(note|message|attention)\s+(to|for)\s+(the\s+)?(ai|assistant|agent|model|llm)/, 45, 'EMBEDDED_INSTRUCTION'],
  [/(read|retrieve|fetch|forward|send|expose|disclose)\b.{0,30}\b(all|every)\b.{0,25}(emails?|files?|documents?|results?|messages?)/, 50, 'DATA_EXFILTRATION'],
  [/(transfer|wire|send)\s+\$?\d[\d,]*\s*(to|into)\b/, 45, 'UNAUTHORIZED_ACTION'],
  [/delete\s+(the\s+)?(file|files|all|every)\b/, 40, 'UNAUTHORIZED_ACTION'],
  [/search\s+the\s+workspace\s+for/, 30, 'UNAUTHORIZED_ACTION'],
];

export function scan(text, { untrusted = false } = {}) {
  const t = norm(text);
  const rules = untrusted ? [...COMMON, ...UNTRUSTED_ONLY] : COMMON;
  const matches = [];
  let score = 0;
  for (const [re, w, label] of rules) if (re.test(t)) { score += w; matches.push(label); }
  score = Math.min(100, score);
  const labels = [...new Set(matches)];
  const category = labels.includes('PRIVILEGE_ESCALATION') ? 'PRIVILEGE_ESCALATION'
    : labels.includes('DATA_EXFILTRATION') ? 'SENSITIVE_DATA_EXPOSURE' : labels[0] || null;
  return {
    score, matches: labels, flagged: score >= 40,
    threatType: score >= 40 ? (untrusted ? 'INDIRECT_PROMPT_INJECTION' : category === 'PRIVILEGE_ESCALATION' ? 'PRIVILEGE_ESCALATION' : 'DIRECT_PROMPT_INJECTION') : null,
    category,
  };
}
