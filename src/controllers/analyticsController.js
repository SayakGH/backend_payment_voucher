const analyticsRepo = require("../repository/analytics.repo");
const paymentRepo = require("../repository/payments.repo");

exports.getFinancialStats = async (req, res) => {
  try {
    const stats = await analyticsRepo.getGlobalFinancialStats();

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Analytics Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch analytics",
    });
  }
};

exports.getAnalyticsSummary = async (req, res) => {
  try {
    const last30DaysPayments = await paymentRepo.getLast30DaysPayments();

    res.status(200).json({
      success: true,
      analytics: {
        last30DaysPayments,
      },
    });
  } catch (err) {
    console.error("Analytics Controller Error:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: err.message,
    });
  }
};
