const router = require("express").Router();
const {
  getFinancialStats,
  getAnalyticsSummary,
} = require("../controllers/analyticsController");
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.get("/", auth, authorizeRoles("admin"), getFinancialStats);
router.get("/summary", auth, authorizeRoles("admin"), getAnalyticsSummary);

module.exports = router;
