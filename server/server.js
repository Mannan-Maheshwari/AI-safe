import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';
import { seedDefaults } from './services/security/seed.js';
import { providerInfo, checkGemini } from './services/ai/provider.js';

try {
  await mongoose.connect(config.mongo, { serverSelectionTimeoutMS: 8000 });
  await seedDefaults();
  app.listen(config.port, async () => {
    const p = providerInfo();
    console.log(`Agent Shield API on :${config.port} — AI provider: ${p.name} (${p.model})`);
    await checkGemini();
    if (p.name === 'mock') console.log('No GEMINI_API_KEY set: using the offline simulated agent.');
  });
} catch (e) {
  console.error('Startup failed:', e.message);
  process.exit(1);
}
