const {
  PutCommand,
  UpdateCommand,
  ScanCommand,
  GetCommand,
  DeleteCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const generatePaymentId = require("../utils/generatePaymentId");
const { dynamoDB } = require("../config/dynamo");

const COMPANY_MASTER = require("../constants/companyMaster");
const vendorRepo = require("./vendor.repo");
const projectRepo = require("./project.repo");

const PAYMENT_TABLE = "payment_app_payments";
const PROJECT_TABLE = "payment_app_projects";

const createPayment = async ({
  projectId,
  items,
  itemsTotal,
  gst,
  total,
  paymentSummary,
}) => {
  if (!projectId) throw new Error("projectId is required");
  if (!items || items.length === 0) throw new Error("Items required");
  if (itemsTotal <= 0) throw new Error("Invalid itemsTotal");
  if (total <= 0) throw new Error("Invalid total");

  const project = await projectRepo.getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const vendor = await vendorRepo.findVendorById(project.vendorId);
  if (!vendor) throw new Error("Vendor not found");

  const company = COMPANY_MASTER[project.companyName];
  if (!company)
    throw new Error(`Company config not found: ${project.companyName}`);

  if (paymentSummary.mode === "Cheque") {
    if (!paymentSummary.bankName || !paymentSummary.chequeNumber) {
      throw new Error(
        "bankName and chequeNumber are required for Cheque payments"
      );
    }
  }

  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const payment = {
    _id: generatePaymentId(),
    projectId,
    vendor: {
      name: vendor.name,
      gstin: vendor.gstin || "",
      address: vendor.address,
      pan: vendor.pan,
      phone: vendor.phone,
    },
    company: {
      name: company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
    },
    paymentSummary: {
      mode: paymentSummary.mode,
      bankName:
        paymentSummary.mode === "Cheque" ? paymentSummary.bankName : null,
      chequeNumber:
        paymentSummary.mode === "Cheque" ? paymentSummary.chequeNumber : null,
    },
    items,
    itemsTotal,
    gst,
    total,
    createdAt: istDate.toISOString(),
  };

  // 🔒 ATOMIC TRANSACTION
  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: PAYMENT_TABLE,
            Item: payment,
            ConditionExpression: "attribute_not_exists(#id)",
            ExpressionAttributeNames: { "#id": "_id" },
          },
        },
        {
          Update: {
            TableName: PROJECT_TABLE,
            Key: { _id: projectId },
            UpdateExpression: `
            SET 
              paid    = if_not_exists(paid, :zero) + :amt,
              balance = if_not_exists(balance, :zero) - :amt
          `,
            ExpressionAttributeValues: {
              ":amt": total,
              ":zero": 0,
            },
            ConditionExpression: "attribute_exists(#id)",
            ExpressionAttributeNames: { "#id": "_id" },
          },
        },
      ],
    })
  );

  return payment;
};

const getPaymentsByProjectId = async (projectId) => {
  const params = {
    TableName: PAYMENT_TABLE,
    FilterExpression: "projectId = :pid",
    ExpressionAttributeValues: {
      ":pid": projectId,
    },
  };

  const res = await dynamoDB.send(new ScanCommand(params));

  const payments = res.Items || [];

  // Sort latest first
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return payments;
};

const deletePayment = async (paymentId) => {
  if (!paymentId) throw new Error("paymentId is required");

  // Load payment first
  const res = await dynamoDB.send(
    new GetCommand({
      TableName: PAYMENT_TABLE,
      Key: { _id: paymentId },
    })
  );

  if (!res.Item) throw new Error("Payment not found");

  const { projectId, total } = res.Item;

  // 🔒 ATOMIC DELETE + LEDGER REVERSE
  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: PAYMENT_TABLE,
            Key: { _id: paymentId },
            ConditionExpression: "attribute_exists(#id)",
            ExpressionAttributeNames: { "#id": "_id" },
          },
        },
        {
          Update: {
            TableName: PROJECT_TABLE,
            Key: { _id: projectId },
            UpdateExpression: `
              SET 
                billed = billed - :amt,
                paid   = paid   - :amt
            `,
            ExpressionAttributeValues: {
              ":amt": total,
            },
            ConditionExpression: "attribute_exists(#id)",
            ExpressionAttributeNames: { "#id": "_id" },
          },
        },
      ],
    })
  );

  return { success: true };
};

const deleteAllPaymentsByProject = async (projectId) => {
  if (!projectId) throw new Error("projectId is required");

  try {
    // 1️⃣ Fetch all payments
    const res = await dynamoDB.send(
      new ScanCommand({
        TableName: PAYMENT_TABLE,
        FilterExpression: "projectId = :pid",
        ExpressionAttributeValues: {
          ":pid": projectId,
        },
      })
    );

    const payments = res.Items || [];

    // 2️⃣ Delete all
    for (const p of payments) {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: PAYMENT_TABLE,
          Key: { _id: p._id },
        })
      );
    }

    return { deleted: payments.length };
  } catch (err) {
    throw new Error(`Delete Payments Failed: ${err.message}`);
  }
};

const getLast30DaysPayments = async () => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({ TableName: PAYMENT_TABLE })
    );

    const payments = result.Items || [];

    /* ============================
       Create IST "Today"
    ============================ */
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    istNow.setHours(0, 0, 0, 0);

    const startDate = new Date(istNow);
    startDate.setDate(startDate.getDate() - 29);

    /* ============================
       Create date map (TRUE IST KEYS)
    ============================ */
    const dateMap = {};

    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      const key = `${y}-${m}-${day}`; // IST date key

      dateMap[key] = {
        price: 0,
        day: d.getDate(),
        month: d.toLocaleString("en-IN", { month: "short" }),
      };
    }

    /* ============================
       Aggregate payments
    ============================ */
    for (const p of payments) {
      if (!p.createdAt || !p.total) continue;

      // DB timestamp already treated as IST
      const key = p.createdAt.split("T")[0];

      if (dateMap[key]) {
        dateMap[key].price += Number(p.total);
      }
    }

    /* ============================
       Return sorted array
    ============================ */
    return Object.keys(dateMap)
      .sort()
      .map((k) => dateMap[k]);
  } catch (err) {
    throw new Error(`30 Days Payment Summary Error: ${err.message}`);
  }
};

const deleteAllPaymentsByVendorId = async (vendorId) => {
  if (!vendorId) throw new Error("vendorId is required");

  try {
    // 1️⃣ Fetch all payments for vendor
    const res = await dynamoDB.send(
      new ScanCommand({
        TableName: PAYMENT_TABLE,
        FilterExpression: "vendorId = :vid",
        ExpressionAttributeValues: {
          ":vid": vendorId,
        },
      })
    );

    const payments = res.Items || [];

    // 2️⃣ Delete all payments
    for (const p of payments) {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: PAYMENT_TABLE,
          Key: { _id: p._id },
        })
      );
    }

    return {
      success: true,
      deleted: payments.length,
    };
  } catch (err) {
    throw new Error(`Delete Vendor Payments Failed: ${err.message}`);
  }
};

const findPaymentById = async (id) => {
  const params = {
    TableName: PAYMENT_TABLE,
    Key: { _id: id },
  };

  try {
    const command = new GetCommand(params);
    const res = await dynamoDB.send(command);
    return res.Item;
  } catch (err) {
    throw new Error(`DynamoDB Payment Find Error: ${err.message}`);
  }
};

const createPaymentv2 = async ({
  vendorId,
  companyName,
  items,
  itemsTotal,
  gst,
  total,
  paymentSummary,
}) => {
  if (!vendorId) throw new Error("vendorId is required");
  if (!items || items.length === 0) throw new Error("Items required");
  if (itemsTotal <= 0) throw new Error("Invalid itemsTotal");
  if (total <= 0) throw new Error("Invalid total");

  // 1️⃣ Load vendor
  const vendor = await vendorRepo.findVendorById(vendorId);
  if (!vendor) throw new Error("Vendor not found");

  // 2️⃣ Load company
  const company = COMPANY_MASTER[companyName || "DEFAULT"];
  if (!company) throw new Error("Company config not found");

  // 3️⃣ Validate cheque
  if (paymentSummary.mode === "Cheque") {
    if (!paymentSummary.bankName || !paymentSummary.chequeNumber) {
      throw new Error(
        "bankName and chequeNumber are required for Cheque payments"
      );
    }
  }

  // 4️⃣ IST time
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  // 5️⃣ Payment object
  const payment = {
    _id: generatePaymentId(),
    vendorId: vendor._id,

    vendor: {
      name: vendor.name,
      gstin: vendor.gstin || "",
      address: vendor.address,
      pan: vendor.pan,
      phone: vendor.phone,
    },

    company: {
      name: company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
    },

    paymentSummary: {
      mode: paymentSummary.mode,
      bankName:
        paymentSummary.mode === "Cheque" ? paymentSummary.bankName : null,
      chequeNumber:
        paymentSummary.mode === "Cheque" ? paymentSummary.chequeNumber : null,
    },

    items,
    itemsTotal,
    gst,
    total,
    createdAt: istDate.toISOString(),
  };

  // 6️⃣ Atomic write (NO project update)
  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: PAYMENT_TABLE,
            Item: payment,
            ConditionExpression: "attribute_not_exists(#id)",
            ExpressionAttributeNames: { "#id": "_id" },
          },
        },
      ],
    })
  );

  return payment;
};

const getPaymentsByVendorId = async (vendorId) => {
  if (!vendorId) throw new Error("vendorId is required");

  const res = await dynamoDB.send(
    new ScanCommand({
      TableName: PAYMENT_TABLE,
      FilterExpression: "vendorId = :vid",
      ExpressionAttributeValues: {
        ":vid": vendorId,
      },
    })
  );

  const payments = res.Items || [];

  // Sort newest first
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return payments;
};

module.exports = {
  createPayment,
  getPaymentsByProjectId,
  deletePayment,
  deleteAllPaymentsByProject,
  getLast30DaysPayments,
  findPaymentById,
  createPaymentv2,
  getPaymentsByVendorId,
  deleteAllPaymentsByVendorId,
};
