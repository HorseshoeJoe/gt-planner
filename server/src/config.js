/**
 * All configuration lives here with working defaults.
 *
 * There is no .env file and nothing to fill in: the prototype runs correctly
 * straight after `npm install`. Every value can still be overridden with an
 * environment variable if the marker wants to (for example a different PORT).
 */
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  /** Port the API listens on. The React dev server proxies /api to it. */
  port: Number(process.env.PORT) || 5000,

  /** Where the data file lives: server/data.json */
  dataFile: process.env.DATA_FILE || path.join(here, '..', 'data.json'),

  /**
   * Secret used to sign login tokens. A fixed development default is used so
   * there is nothing to configure; a real deployment would set JWT_SECRET.
   */
  jwtSecret: process.env.JWT_SECRET || 'group-travel-planner-local-development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  /** Origin allowed by CORS (the Vite dev server). */
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  /** Proposal non-functional requirement: trips support up to 20 members. */
  maxMembersPerTrip: 20,
};

export default config;
