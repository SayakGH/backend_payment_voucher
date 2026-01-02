const vendorRepo = require("../repository/vendor.repo");
const projectRepo = require("../repository/project.repo");
const billRepo = require("../repository/bill.repo");
const paymentRepo = require("../repository/payments.repo");

exports.createVendor = async (req, res) => {
  try {
    const { name, phone, address, pan, gstin } = req.body;

    if (!name || !phone || !address || !pan) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, address and PAN are required",
      });
    }

    const vendor = await vendorRepo.createVendor({
      name,
      phone,
      address,
      pan,
      gstin,
    });

    return res.status(201).json({
      success: true,
      vendor,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await vendorRepo.getAllVendors();

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.createProjects = async (req, res) => {
  try {
    const { vendorId, projectName, companyName, estimated } = req.body;

    // Validation
    if (!vendorId || !projectName || !companyName) {
      return res.status(400).json({
        success: false,
        message: "vendorId, projectName and companyName are required",
      });
    }

    const project = await projectRepo.createProject({
      vendorId,
      projectName,
      companyName,
      estimated,
    });

    return res.status(201).json({
      success: true,
      project,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getVendorProjects = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "vendorId is required",
      });
    }

    const vendor = await vendorRepo.findVendorById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "vendor not found",
      });
    }

    const projects = await projectRepo.getProjectsByVendor(vendorId);

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects: projects,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.createProjectBill = async (req, res) => {
  try {
    const { projectId, description, amount } = req.body;

    if (!projectId || !description || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "projectId, description and amount are required",
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const bill = await billRepo.createBill({
      projectId,
      description,
      amount: Number(amount),
    });

    return res.status(201).json({
      success: true,
      bill,
    });
  } catch (err) {
    console.error("Create Bill Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create bill",
    });
  }
};

exports.getProjectBills = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    const bills = await billRepo.getBillsByProject(projectId);

    return res.json({
      success: true,
      count: bills.length,
      bills,
    });
  } catch (err) {
    console.error("Fetch Bills Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch bills",
    });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;
    if (!billId) {
      return res.status(404).json({
        success: false,
        message: "Provide billId",
      });
    }
    await billRepo.deleteBill(billId);
    return res.status(200).json({
      success: true,
      message: "successfully deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete bill",
    });
  }
};
exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(404).json({
        success: false,
        message: "Provide projectId",
      });
    }
    await paymentRepo.deleteAllPaymentsByProject(projectId);
    await billRepo.deleteAllBillsByProject(projectId);
    await projectRepo.deleteProjectById(projectId);
    return res.status(200).json({
      success: true,
      message: "successfully deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete project",
    });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "vendorId is required",
      });
    }

    await vendorRepo.deleteVendorById(vendorId);

    return res.status(200).json({
      success: true,
      message: "Vendor and all related data deleted successfully",
    });
  } catch (error) {
    console.error("Delete Vendor Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete vendor",
    });
  }
};
