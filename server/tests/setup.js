import os from 'os';
import path from 'path';
import crypto from 'crypto';

/**
 * Point the store at a throwaway file in the OS temp folder before any module
 * imports it, so running the tests never touches server/data.json.
 */
process.env.NODE_ENV = 'test';
process.env.DATA_FILE = path.join(os.tmpdir(), `gtp-test-${crypto.randomUUID()}.json`);
