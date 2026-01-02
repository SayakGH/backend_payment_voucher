const {
  PutCommand,
  UpdateCommand,
  ScanCommand,
  GetCommand,
  DeleteCommand,
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

  /* 1️⃣ Load Project */
  const project = await projectRepo.getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  /* 2️⃣ Load Vendor */
  const vendor = await vendorRepo.findVendorById(project.vendorId);
  if (!vendor) throw new Error("Vendor not found");

  /* 3️⃣ Company Snapshot */
  const company = COMPANY_MASTER[project.companyName];
  if (!company)
    throw new Error(`Company config not found: ${project.companyName}`);

  if (paymentSummary.mode === "Cheque") {
    if (!paymentSymmary.bankName || !paymentSummary.chequeNumber) {
      throw new Error(
        "bankName and chequeNumber are required for Cheque payments"
      );
    }
  }

  /* 4️⃣ Build Voucher */
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

  /* 5️⃣ Save Payment */
  await dynamoDB.send(
    new PutCommand({
      TableName: PAYMENT_TABLE,
      Item: payment,
    })
  );

  /* 6️⃣ Correct Ledger Update (Billed ↑ , Paid ↑ , Balance auto-calculated) */
  await dynamoDB.send(
    new UpdateCommand({
      TableName: PROJECT_TABLE,
      Key: { _id: projectId },
      UpdateExpression: `
      SET 
        billed = if_not_exists(billed, :zero) + :amt,
        paid   = if_not_exists(paid, :zero) + :amt
    `,
      ExpressionAttributeValues: {
        ":amt": total,
        ":zero": 0,
      },
      ConditionExpression: "attribute_exists(#id)",
      ExpressionAttributeNames: {
        "#id": "_id",
      },
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

  try {
    /* 1️⃣ Load payment */
    const res = await dynamoDB.send(
      new GetCommand({
        TableName: PAYMENT_TABLE,
        Key: { _id: paymentId },
      })
    );

    if (!res.Item) throw new Error("Payment not found");

    const { projectId, total } = res.Item;

    /* 2️⃣ Delete payment */
    await dynamoDB.send(
      new DeleteCommand({
        TableName: PAYMENT_TABLE,
        Key: { _id: paymentId },
      })
    );

    /* 3️⃣ Reverse ledger */
    await dynamoDB.send(
      new UpdateCommand({
        TableName: PROJECT_TABLE,
        Key: { _id: projectId },
        UpdateExpression: `
          SET 
            billed = billed - :amt,
            paid   = paid   - :amt
        `,
        ConditionExpression: "attribute_exists(#id)",
        ExpressionAttributeNames: {
          "#id": "_id",
        },
        ExpressionAttributeValues: {
          ":amt": total,
        },
      })
    );

    return { success: true };
  } catch (err) {
    throw new Error(`Delete Payment Failed: ${err.message}`);
  }
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
       Today & start (IST calendar)
    ============================ */
    const now = new Date();
    const istNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    istNow.setHours(0, 0, 0, 0);

    const startDate = new Date(istNow);
    startDate.setDate(startDate.getDate() - 29);

    /* ============================
       Create date map (IST days)
    ============================ */
    const dateMap = {};

    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const key = d.toISOString().split("T")[0];

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

      const key = p.createdAt.split("T")[0]; // IST date key

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
module.exports = {
  createPayment,
  getPaymentsByProjectId,
  deletePayment,
  deleteAllPaymentsByProject,
  getLast30DaysPayments,
  findPaymentById,
};
