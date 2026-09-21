import path from 'path';
import { config } from './config.js';
import { createApp } from './app.js';
import { dataFilePath } from './db/store.js';
import './db/index.js'; // loads (and creates on first run) the data file

const app = createApp();

app.listen(config.port, () => {
  console.log('');
  console.log('  Group Travel Planner API');
  console.log(`  Listening on   http://localhost:${config.port}`);
  console.log(`  Data file      ${path.basename(dataFilePath())} (in the server folder)`);
  console.log(`  Health check   http://localhost:${config.port}/api/health`);
  console.log('');
});
