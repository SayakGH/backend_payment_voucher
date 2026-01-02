const generatePaymentId = () => {
  const now = Date.now().toString().slice(-6); // last 6 digits
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PV-${now}-${random}`;
};

module.exports = generatePaymentId;
