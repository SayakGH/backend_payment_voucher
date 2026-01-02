const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDB } = require("../config/dynamo");

const BILL_TABLE = "payment_app_project_bills";
const PAYMENT_TABLE = "payment_app_payments";

const getGlobalFinancialStats = async () => {
  try {
    // Fetch all bills
    const billsRes = await dynamoDB.send(
      new ScanCommand({ TableName: BILL_TABLE })
    );
    const bills = billsRes.Items || [];

    // Fetch all payments
    const payRes = await dynamoDB.send(
      new ScanCommand({ TableName: PAYMENT_TABLE })
    );
    const payments = payRes.Items || [];

    const totalBilled = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalPaymentCount = payments.length;

    return {
      totalPaymentCount,
      totalPayments,
      totalBilled,
    };
  } catch (err) {
    throw new Error(`Analytics Repo Error: ${err.message}`);
  }
};

module.exports = {
  getGlobalFinancialStats,
};
