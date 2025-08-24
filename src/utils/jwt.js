const jwt = require('jsonwebtoken');
const config = require('../config/config');

const jwtUtils = {
  createToken(payload, expiresIn = config.jwt.expiresIn) {
    return jwt.sign(payload, config.jwt.secret, {
      algorithm: config.jwt.algorithm,
      expiresIn
    });
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  },

  extractTokenFromCookies(req) {
    const token = req.cookies.access_token;
    if (!token) {
      throw new Error('Token not provided');
    }
    return token;
  }
};

module.exports = jwtUtils;