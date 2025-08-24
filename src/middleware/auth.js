const jwtUtils = require('../utils/jwt');

const authenticateToken = (req, res, next) => {
  try {
    const token = jwtUtils.extractTokenFromCookies(req);
    const decoded = jwtUtils.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
};

module.exports = { authenticateToken };