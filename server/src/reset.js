/**
 * Wipes all saved data:  npm run reset  (from the server folder)
 * Equivalent to deleting server/data.json by hand.
 */
import { clearAll, dataFilePath } from './db/store.js';
import './db/index.js';

clearAll();
console.log(`Cleared all data in ${dataFilePath()}`);
