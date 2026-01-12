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
  deleteVendorv2,
} = require("../controllers/vendorController");
const {
  createPayment,
  createPaymentv2,
  getProjectPayments,
  deletePayment,
  getPaymentById,
  getVendorPayments,
  deleteVendorPayments,
} = require("../controllers/paymentController");

router.post("/create", auth, createVendor);
router.get("/", auth, getAllVendors);
router.get("/projects/:vendorId", auth, getVendorProjects);
router.post("/create/project", auth, createProjects);
router.get("/bills/:projectId", auth, getProjectBills);
router.post("/create/bill", auth, createProjectBill);
router.get("/payments/:projectId", auth, getProjectPayments);
router.get("/payments/vendor/:vendorId", auth, getVendorPayments);
router.post("/create/payment", auth, createPayment);
router.post("/create/payment/v2", auth, createPaymentv2);
router.get("/single/payment/:id", auth, getPaymentById);

router.delete(
  "/delete/vendor/payments/:vendorId",
  auth,
  authorizeRoles("admin"),
  deleteVendorv2
);
router.delete(
  "/delete/bill/:billId",
  auth,
  authorizeRoles("admin"),
  deleteBill
);
router.delete(
  "/delete/payment/:paymentId",
  auth,
  authorizeRoles("admin"),
  deletePayment
);
router.delete(
  "/delete/project/:projectId",
  auth,
  authorizeRoles("admin"),
  deleteProject
);
router.delete(
  "/delete/vendor/:vendorId",
  auth,
  authorizeRoles("admin"),
  deleteVendor
);

module.exports = router;
