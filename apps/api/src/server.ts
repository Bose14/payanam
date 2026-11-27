import express from 'express';
import cors from 'cors';
import compression from 'compression';
import env from './config/environment';
import { initializeDatabase } from './config/database';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { errorHandler } from './middleware/error.middleware';
import { registerRoutes } from './routes/index';
import { checkMissingRiders } from './services/ride.service';
import { pushEnabled } from './services/push.service';

const app = express();

// Behind Render's proxy: use the real client address, hide the framework, compress JSON, add basic headers.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [env.CORS_ORIGIN, env.FRONTEND_URL].filter(Boolean);
const isDev = env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    // In development or on local Wi-Fi, allow localhost, 127.0.0.1, and private LAN IPs
    if (
      !origin ||
      isDev ||
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(requestIdMiddleware);

try {
  initializeDatabase();
  console.log('Database initialized');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

registerRoutes(app);

app.use(errorHandler);

const PORT = env.PORT;
const missingRidersTimer = pushEnabled
  ? setInterval(() => { checkMissingRiders().catch(() => undefined); }, 60 * 1000)
  : null;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// Render stops the old server when a new deploy goes live: finish the requests in flight first.
function shutdown(signal: string) {
  console.log(`${signal} received, closing the server`);
  if (missingRidersTimer) clearInterval(missingRidersTimer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
