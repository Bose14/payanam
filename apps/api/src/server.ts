import express from 'express';
import cors from 'cors';
import env from './config/environment';
import { initializeDatabase } from './config/database';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(requestIdMiddleware);

try {
  initializeDatabase();
  console.log('Database initialized');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});
