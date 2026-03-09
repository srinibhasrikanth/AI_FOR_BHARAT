const jwt = require('jsonwebtoken');
const { ApiError, asyncHandler } = require('../utils/api.utils');

/**
 * Verify JWT access token from Authorization header or cookie
 */
const verifyJWT = asyncHandler(async (req, _res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "").trim();

  if (!token) {
    throw new ApiError(401, "Unauthorized: No token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    throw new ApiError(401, 'Unauthorized: Invalid or expired token');
  }
});

/**
 * Check if user has required role
 */
const checkRole = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user || !req.user.role) {
      throw new ApiError(401, 'Unauthorized: User role not found');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'Forbidden: Insufficient permissions');
    }

    next();
  };
};

module.exports = { verifyJWT, checkRole };
