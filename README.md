# Agent Shield: zero-trust firewall for AI agents

MERN + Gemini micro project. The LLM proposes tool calls; the **gateway** decides ALLOW / BLOCK / REQUIRE_APPROVAL.

## Run it

Prerequisites: Node 18+ and MongoDB (local, or an Atlas URI).

```bash
# 1. API
cd server
cp .env.example .env      # set MONGODB_URI, JWT_SECRET, optionally GEMINI_API_KEY
npm install
npm run dev               # http://localhost:5000

# 2. Web app (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173 (proxies /api to :5000)
```

Register an account (the first account becomes the admin), then open **Attack Simulator** and press **Run full benchmark**.

## No Gemini key?
Without `GEMINI_API_KEY` the backend uses an offline mock agent that is deliberately gullible (it obeys injected
instructions), so the protected-vs-unprotected comparison still works. Add a key to use real Gemini
(`GEMINI_MODEL` defaults to `gemini-2.0-flash`; the provider is isolated in `server/services/ai/provider.js`).

## How a tool call flows
`server/services/agent/agent.js` -> `security/gateway.js`
1. unknown tool, 2. Zod argument validation, 3. tool permission, 4. resource ownership,
5. configurable policies (transfer limit, taint block, approvals), 6. AI risk assessment (can only escalate),
7. decision, 8. audit log. Any internal error **fails closed** (BLOCK).
Approvals (`security/approvals.js`) are hash-bound to the exact arguments, expire, are claimed atomically, and are re-validated before execution.

## Layout
```
server/  config.js, models/, middleware/, routes/, services/{ai,agent,security,tools,simulator}
client/  src/{pages,components,context,services}
dataset/ starter attack + benign cases
```

## Notes
- `bcryptjs` is used instead of native `bcrypt` (same algorithm, no build tools needed).
- Tools only touch mock data in MongoDB. There is no shell, filesystem or URL tool.
- Not yet included: a Jest/Vitest suite in `server/tests/` and the full 150-case dataset.
