import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { config } from './config.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

const limiter = (windowMs, max) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests — please slow down.' } });
app.use('/api', limiter(15 * 60000, 1500));
app.use('/api/auth/login', limiter(15 * 60000, 20));
app.use('/api/auth/register', limiter(60 * 60000, 20));
app.use('/api/agent/chat', limiter(60000, 40));
app.use('/api/simulator', limiter(60000, 30));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Never leak stack traces or secrets
app.use((err, req, res, next) => {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server. Please try again.' : err.message });
});

export default app;
