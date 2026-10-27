import express from 'express';
import cors from 'cors';
import env from './config/environment';
import { initializeDatabase } from './config/database';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { errorHandler } from './middleware/error.middleware';
import { registerRoutes } from './routes/index';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [env.CORS_ORIGIN, env.FRONTEND_URL].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || allowedOrigins.includes(origin)) {
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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});
