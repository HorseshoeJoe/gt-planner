import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';

import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import itineraryRoutes from './routes/itineraries.js';
import attractionRoutes from './routes/attractions.js';
import restaurantRoutes from './routes/restaurants.js';
import transportationRoutes from './routes/transportation.js';
import budgetRoutes from './routes/budget.js';
import suggestionsRouter from './routes/suggestions.js';
import { notFound, errorHandler } from './middleware/errors.js';

/**
 * The Express app is built separately from the server bootstrap so the test
 * suite can import it without opening a port.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', service: 'group-travel-planner-api', time: new Date().toISOString() })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/trips', tripRoutes);
  app.use('/api/trips/:tripId/itinerary', itineraryRoutes);
  app.use('/api/trips/:tripId/attractions', attractionRoutes);
  app.use('/api/trips/:tripId/restaurants', restaurantRoutes);
  app.use('/api/trips/:tripId/transportation', transportationRoutes);
  app.use('/api/trips/:tripId/budget', budgetRoutes);
  app.use('/api/trips/:tripId/suggestions', suggestionsRouter)

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
