const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const { getAllNonAdminUsers } = require("../controllers/userController");

router.get("/", auth, authorizeRoles("admin"), getAllNonAdminUsers);

module.exports = router;
