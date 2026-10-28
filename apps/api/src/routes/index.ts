import { Express } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import tripRoutes, { roomRoutes, publicRoomRoutes } from './trip.routes';
import rideRoutes from './ride.routes';

const registry = [
  { path: '/health', router: healthRoutes },
  { path: '/auth',   router: authRoutes },
  { path: '/trips',  router: tripRoutes },
  { path: '/rooms',  router: publicRoomRoutes }, // public preview — no auth
  { path: '/rooms',  router: roomRoutes },
  { path: '/rides',  router: rideRoutes },
];

export function registerRoutes(app: Express) {
  registry.forEach(({ path, router }) => {
    app.use(`/api${path}`, router);
  });
}
