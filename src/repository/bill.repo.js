const {
  ScanCommand,
  DeleteCommand,
  GetCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { dynamoDB } = require("../config/dynamo");

const BILL_TABLE = "payment_app_project_bills";
const PROJECT_TABLE = "payment_app_projects";

const createBill = async ({ projectId, description, amount }) => {
  if (!projectId) throw new Error("projectId is required");
  if (!description) throw new Error("description is required");
  if (!amount || amount <= 0) throw new Error("Invalid amount");

  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const bill = {
    _id: randomUUID(),
    projectId,
    description,
    amount,
    createdAt: istDate.toISOString(),
  };

  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: BILL_TABLE,
            Item: bill,
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
                billed  = if_not_exists(billed, :zero) + :amt,
                balance = if_not_exists(balance, :zero) + :amt
            `,
            ExpressionAttributeValues: {
              ":amt": amount,
              ":zero": 0,
            },
            ConditionExpression: "attribute_exists(#id)",
            ExpressionAttributeNames: { "#id": "_id" },
          },
        },
      ],
    })
  );

  return bill;
};

const getBillsByProject = async (projectId) => {
  const params = {
    TableName: BILL_TABLE,
    FilterExpression: "projectId = :pid",
    ExpressionAttributeValues: {
      ":pid": projectId,
    },
  };

  try {
    const res = await dynamoDB.send(new ScanCommand(params));

    // sort latest first
    return (res.Items || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  } catch (err) {
    throw new Error(`Fetch Bills Failed: ${err.message}`);
  }
};

const deleteBill = async (billId) => {
  if (!billId) throw new Error("billId is required");

  const billRes = await dynamoDB.send(
    new GetCommand({
      TableName: BILL_TABLE,
      Key: { _id: billId },
    })
  );

  if (!billRes.Item) throw new Error("Bill not found");

  const { projectId, amount } = billRes.Item;

  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: BILL_TABLE,
            Key: { _id: billId },
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
                billed  = billed - :amt,
                balance = balance - :amt
            `,
            ExpressionAttributeValues: {
              ":amt": amount,
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

const deleteAllBillsByProject = async (projectId) => {
  if (!projectId) throw new Error("projectId is required");

  try {
    // 1️⃣ Fetch all bills
    const res = await dynamoDB.send(
      new ScanCommand({
        TableName: BILL_TABLE,
        FilterExpression: "projectId = :pid",
        ExpressionAttributeValues: {
          ":pid": projectId,
        },
      })
    );

    const bills = res.Items || [];

    // 2️⃣ Delete all
    for (const bill of bills) {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: BILL_TABLE,
          Key: { _id: bill._id },
        })
      );
    }

    return { deleted: bills.length };
  } catch (err) {
    throw new Error(`Delete Bills Failed: ${err.message}`);
  }
};

module.exports = {
  createBill,
  getBillsByProject,
  deleteBill,
  deleteAllBillsByProject,
};
