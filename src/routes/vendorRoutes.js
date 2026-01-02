const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAllVendors,
  createVendor,
  getVendorProjects,
  createProjects,
  getProjectBills,
  createProjectBill,
  deleteBill,
  deleteProject,
  deleteVendor,
} = require("../controllers/vendorController");
const {
  createPayment,
  getProjectPayments,
  deletePayment,
  getPaymentById,
} = require("../controllers/paymentController");

router.post("/create", auth, createVendor);
router.get("/", auth, getAllVendors);
router.get("/projects/:vendorId", auth, getVendorProjects);
router.post("/create/project", auth, createProjects);
router.get("/bills/:projectId", auth, getProjectBills);
router.post("/create/bill", auth, createProjectBill);
router.get("/payments/:projectId", auth, getProjectPayments);
router.post("/create/payment", auth, createPayment);
router.get("/single/payment/:id", auth, getPaymentById);

router.delete("/delete/bill/:billId", auth, deleteBill);
router.delete("/delete/payment/:paymentId", auth, deletePayment);
router.delete("/delete/project/:projectId", auth, deleteProject);
router.delete("/delete/vendor/:vendorId", auth, deleteVendor);

module.exports = router;
