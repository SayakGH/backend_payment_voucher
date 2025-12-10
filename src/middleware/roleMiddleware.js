const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: Token missing" });
      }

      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded || !decoded.userId) {
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
      }

      // Extract from JWT payload
      const userId = decoded.userId;
      const tokenRole = decoded.role;

      // OPTIONAL: Fetch fresh user role from DB
      const user = await User.findById(userId).select("-password");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check requested route vs user role
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error("Authorization Error:", err);
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid or expired token" });
    }
  };
};

module.exports = authorizeRoles;
