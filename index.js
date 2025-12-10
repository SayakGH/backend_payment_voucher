const dotenv = require("dotenv");
const connectDB = require("./src/config/db");
const app = require("./src/app");

async function startServer() {
  dotenv.config();
  console.log("Pinging database...");

  await connectDB();

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
