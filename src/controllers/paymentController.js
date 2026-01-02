const paymentRepo = require("../repository/payments.repo");
const projectRepo = require("../repository/project.repo");

/* ================= CREATE PAYMENT ================= */

exports.createPayment = async (req, res) => {
  try {
    const { projectId, items, itemsTotal, gst, total, paymentSummary } =
      req.body;

    /* Validation */
    if (!projectId || !items || !itemsTotal || !total) {
      return res.status(400).json({
        success: false,
        message: "projectId, items, itemsTotal and total are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array",
      });
    }

    if (Number(itemsTotal) <= 0 || Number(total) <= 0) {
      return res.status(400).json({
        success: false,
        message: "itemsTotal and total must be greater than 0",
      });
    }

    /* Check Project Exists */
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    /* Create Payment */
    const payment = await paymentRepo.createPayment({
      projectId,
      items,
      itemsTotal: Number(itemsTotal),
      gst,
      total: Number(total),
      paymentSummary,
    });

    return res.status(201).json({
      success: true,
      payment,
    });
  } catch (err) {
    console.error("Create Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create payment",
    });
  }
};

/* ================= GET PAYMENTS BY PROJECT ================= */

exports.getProjectPayments = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "projectId is required",
      });
    }

    /* Check Project Exists */
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const payments = await paymentRepo.getPaymentsByProjectId(projectId);

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (err) {
    console.error("Fetch Payments Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch payments",
    });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(404).json({
        success: false,
        message: "Provide paymentId",
      });
    }
    await paymentRepo.deletePayment(paymentId);
    return res.status(200).json({
      success: true,
      message: "successfully deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete payment",
    });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const payment = await paymentRepo.findPaymentById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (err) {
    console.error("Get Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch payment",
    });
  }
};
