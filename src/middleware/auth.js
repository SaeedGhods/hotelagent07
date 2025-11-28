const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Verify staff credentials
 */
const verifyCredentials = async (username, password) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM staff WHERE username = ? AND is_active = 1',
      [username],
      (err, user) => {
        if (err) {
          return reject(err);
        }

        if (!user) {
          return resolve(null);
        }

        // Verify password
        const bcrypt = require('bcryptjs');
        const isValidPassword = bcrypt.compareSync(password, user.password_hash);

        if (isValidPassword) {
          // Remove password hash from response
          const { password_hash, ...userWithoutPassword } = user;
          resolve(userWithoutPassword);
        } else {
          resolve(null);
        }
      }
    );
  });
};

/**
 * Create new staff user (admin only)
 */
const createStaffUser = async (username, password, name, role = 'staff') => {
  return new Promise((resolve, reject) => {
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(password, saltRounds);

    db.run(
      'INSERT INTO staff (username, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name, role],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, username, name, role });
        }
      }
    );
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  generateToken,
  verifyCredentials,
  createStaffUser
};
