require("dotenv").config();
const app = require("./app");
const PORT = process.env.PORT || 3000;
const connectToDb = require("./config/db");

// Connect to MongoDB
connectToDb();

// Start HTTP Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
