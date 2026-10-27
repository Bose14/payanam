import { Express } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';

const registry = [
  { path: '/health', router: healthRoutes },
  { path: '/auth',   router: authRoutes },
];

export function registerRoutes(app: Express) {
  registry.forEach(({ path, router }) => {
    app.use(`/api${path}`, router);
  });
}
