const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  // Get token from header - check both x-auth-token and Authorization: Bearer
  let token = req.header('x-auth-token');
  
  // If token not found in x-auth-token, check Authorization header
  if (!token && req.header('authorization')) {
    const authHeader = req.header('authorization');
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' from the beginning
    }
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = auth;
