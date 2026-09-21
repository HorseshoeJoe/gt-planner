import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Users, hashPassword, verifyPassword, publicUser, findUserByIdentifier } from '../db/index.js';
import { asyncHandler, requireFields } from '../utils/helpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ sub: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** POST /api/auth/register */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['username', 'email', 'password']);
    if (missing) return res.status(400).json({ message: missing });

    const username = String(req.body.username).trim();
    const email = String(req.body.email).trim().toLowerCase();
    const { password, displayName } = req.body;

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const taken = Users.findOne(
      (u) => u.username.toLowerCase() === username.toLowerCase() || u.email === email
    );
    if (taken) {
      return res.status(409).json({ message: 'An account with that username or email already exists.' });
    }

    const user = Users.insert({
      username,
      email,
      displayName: (displayName || username).trim(),
      passwordHash: await hashPassword(password),
    });

    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  })
);

/** POST /api/auth/login - accepts either username or email as `identifier`. */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const identifier = req.body.identifier || req.body.username || req.body.email;
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Username/email and password are required.' });
    }

    const user = findUserByIdentifier(identifier);

    // Same message for both cases so the endpoint cannot be used to enumerate accounts.
    if (!user || !(await verifyPassword(user, password))) {
      return res.status(401).json({ message: 'Incorrect username/email or password.' });
    }

    return res.json({ token: issueToken(user), user: publicUser(user) });
  })
);

/** GET /api/auth/me - used by the client to restore a session on page load. */
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
