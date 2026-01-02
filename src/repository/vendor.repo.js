const {
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const uuidv4 = () => randomUUID();
const { dynamoDB } = require("../config/dynamo");

const TABLE_NAME = "payment_app_vendor";
const PROJECT_TABLE = "payment_app_projects";
const BILL_TABLE = "payment_app_project_bills";
const PAYMENT_TABLE = "payment_app_payments";

const findVendorById = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { _id: id },
  };

  try {
    const command = new GetCommand(params);
    const res = await dynamoDB.send(command);
    return res.Item;
  } catch (err) {
    throw new Error(`DynamoDB Vendor Find Error: ${err.message}`);
  }
};

const createVendor = async ({ name, phone, address, pan, gstin }) => {
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const vendor = {
    _id: uuidv4(),
    name,
    phone,
    address,
    pan,
    createdAt: istDate.toISOString(),
  };

  // Add GSTIN only if provided
  if (gstin) vendor.gstin = gstin;

  const params = {
    TableName: TABLE_NAME,
    Item: vendor,
    ConditionExpression: "attribute_not_exists(#id)",
    ExpressionAttributeNames: {
      "#id": "_id",
    },
  };

  try {
    const command = new PutCommand(params);
    await dynamoDB.send(command);
    return vendor;
  } catch (err) {
    throw new Error(`DynamoDB Vendor Create Error: ${err.message}`);
  }
};

const getAllVendors = async () => {
  const params = { TableName: TABLE_NAME };

  try {
    const command = new ScanCommand(params);
    const res = await dynamoDB.send(command);
    return res.Items || [];
  } catch (err) {
    throw new Error(`DynamoDB Vendor Scan Error: ${err.message}`);
  }
};

const deleteVendorById = async (vendorId) => {
  if (!vendorId) throw new Error("vendorId is required");

  try {
    /* 1️⃣ Ensure vendor exists */
    const vendorRes = await dynamoDB.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { _id: vendorId },
      })
    );

    if (!vendorRes.Item) throw new Error("Vendor not found");

    /* 2️⃣ Get all vendor projects */
    const projectRes = await dynamoDB.send(
      new ScanCommand({
        TableName: PROJECT_TABLE,
        FilterExpression: "vendorId = :vid",
        ExpressionAttributeValues: {
          ":vid": vendorId,
        },
      })
    );

    const projects = projectRes.Items || [];

    for (const project of projects) {
      const projectId = project._id;

      /* 3️⃣ Delete all bills for project */
      const billsRes = await dynamoDB.send(
        new ScanCommand({
          TableName: BILL_TABLE,
          FilterExpression: "projectId = :pid",
          ExpressionAttributeValues: {
            ":pid": projectId,
          },
        })
      );

      for (const bill of billsRes.Items || []) {
        await dynamoDB.send(
          new DeleteCommand({
            TableName: BILL_TABLE,
            Key: { _id: bill._id },
          })
        );
      }

      /* 4️⃣ Delete all payments for project */
      const payRes = await dynamoDB.send(
        new ScanCommand({
          TableName: PAYMENT_TABLE,
          FilterExpression: "projectId = :pid",
          ExpressionAttributeValues: {
            ":pid": projectId,
          },
        })
      );

      for (const p of payRes.Items || []) {
        await dynamoDB.send(
          new DeleteCommand({
            TableName: PAYMENT_TABLE,
            Key: { _id: p._id },
          })
        );
      }

      /* 5️⃣ Delete project */
      await dynamoDB.send(
        new DeleteCommand({
          TableName: PROJECT_TABLE,
          Key: { _id: projectId },
        })
      );
    }

    /* 6️⃣ Delete vendor */
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { _id: vendorId },
      })
    );

    return {
      success: true,
      deletedProjects: projects.length,
      vendorId,
    };
  } catch (err) {
    throw new Error(`Delete Vendor Completely Failed: ${err.message}`);
  }
};

module.exports = {
  findVendorById,
  createVendor,
  getAllVendors,
  deleteVendorById,
};
