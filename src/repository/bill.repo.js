const {
  PutCommand,
  UpdateCommand,
  ScanCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { dynamoDB } = require("../config/dynamo");

const BILL_TABLE = "payment_app_project_bills";
const PROJECT_TABLE = "payment_app_projects";

const createBill = async ({ projectId, description, amount }) => {
  if (!projectId) throw new Error("projectId is required");
  if (!description) throw new Error("description is required");
  if (!amount || amount <= 0)
    throw new Error("Bill amount must be greater than 0");

  // IST Time
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

  const bill = {
    _id: randomUUID(),
    projectId,
    description,
    amount,
    createdAt: istDate.toISOString(),
  };

  try {
    /* 1️⃣ Save Bill */
    await dynamoDB.send(
      new PutCommand({
        TableName: BILL_TABLE,
        Item: bill,
      })
    );

    /* 2️⃣ Atomically update Project */
    await dynamoDB.send(
      new UpdateCommand({
        TableName: PROJECT_TABLE,
        Key: { _id: projectId },
        UpdateExpression: `
          SET 
            billed = if_not_exists(billed, :zero) + :amt,
            balance = if_not_exists(balance, :zero) + :amt
        `,
        ConditionExpression: "attribute_exists(#id)",
        ExpressionAttributeNames: {
          "#id": "_id",
        },
        ExpressionAttributeValues: {
          ":amt": amount,
          ":zero": 0,
        },
      })
    );

    return bill;
  } catch (err) {
    throw new Error(`Create Bill Failed: ${err.message}`);
  }
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

  try {
    // 1️⃣ Fetch the bill
    const billRes = await dynamoDB.send(
      new GetCommand({
        TableName: BILL_TABLE,
        Key: { _id: billId },
      })
    );

    if (!billRes.Item) throw new Error("Bill not found");

    const { projectId, amount } = billRes.Item;

    // 2️⃣ Delete the bill
    await dynamoDB.send(
      new DeleteCommand({
        TableName: BILL_TABLE,
        Key: { _id: billId },
      })
    );

    // 3️⃣ Reverse its effect on project
    await dynamoDB.send(
      new UpdateCommand({
        TableName: PROJECT_TABLE,
        Key: { _id: projectId },
        UpdateExpression: `
          SET 
            billed = billed - :amt,
            balance = balance - :amt
        `,
        ConditionExpression: "attribute_exists(#id)",
        ExpressionAttributeNames: {
          "#id": "_id",
        },
        ExpressionAttributeValues: {
          ":amt": amount,
        },
      })
    );

    return { success: true };
  } catch (err) {
    throw new Error(`Delete Bill Failed: ${err.message}`);
  }
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
