const User = require("../models/User");

// GET /api/v1/users
exports.getAllNonAdminUsers = async (req, res) => {
  try {
    // Fetch all users except admins
    const users = await User.find({ role: { $ne: "admin" } }).select(
      "-password"
    );

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
