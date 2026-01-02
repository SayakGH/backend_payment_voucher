const {
  PutCommand,
  ScanCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { dynamoDB } = require("../config/dynamo");

const TABLE_NAME = "payment_app_projects";

const createProject = async ({
  vendorId,
  projectName,
  companyName,
  estimated,
}) => {
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const project = {
    _id: randomUUID(),
    vendorId,
    projectName,
    companyName,
    billed: 0,
    paid: 0,
    balance: 0,
    estimated,
    createdAt: istDate.toISOString(),
  };

  const params = {
    TableName: TABLE_NAME,
    Item: project,
    ConditionExpression: "attribute_not_exists(#id)",
    ExpressionAttributeNames: {
      "#id": "_id",
    },
  };

  try {
    await dynamoDB.send(new PutCommand(params));
    return project;
  } catch (err) {
    throw new Error(`DynamoDB Project Create Error: ${err.message}`);
  }
};

const getProjectsByVendor = async (vendorId) => {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "vendorId = :vendorId",
    ExpressionAttributeValues: {
      ":vendorId": vendorId,
    },
  };

  try {
    const res = await dynamoDB.send(new ScanCommand(params));
    return res.Items || [];
  } catch (err) {
    throw new Error(`DynamoDB Project Fetch Error: ${err.message}`);
  }
};

const deleteProjectById = async (projectId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { _id: projectId },
  };

  try {
    await dynamoDB.send(new DeleteCommand(params));
    return true;
  } catch (err) {
    throw new Error(`DynamoDB Project Delete Error: ${err.message}`);
  }
};

const getProjectById = async (projectId) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { _id: projectId },
  };

  try {
    const command = new GetCommand(params);
    const res = await dynamoDB.send(command);
    return res.Item;
  } catch (err) {
    throw new Error(`DynamoDB Project Find Error: ${err.message}`);
  }
};

const deleteAllProjectsByVendor = async (vendorId) => {
  if (!vendorId) throw new Error("vendorId is required");

  try {
    // 1️⃣ Load all projects
    const res = await dynamoDB.send(
      new ScanCommand({
        TableName: PROJECT_TABLE,
        FilterExpression: "vendorId = :vid",
        ExpressionAttributeValues: {
          ":vid": vendorId,
        },
      })
    );

    const projects = res.Items || [];

    // 2️⃣ Delete them
    for (const p of projects) {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: PROJECT_TABLE,
          Key: { _id: p._id },
        })
      );
    }

    return { deleted: projects.length };
  } catch (err) {
    throw new Error(`Delete Vendor Projects Failed: ${err.message}`);
  }
};
module.exports = {
  createProject,
  getProjectsByVendor,
  deleteProjectById,
  getProjectById,
  deleteAllProjectsByVendor,
};
