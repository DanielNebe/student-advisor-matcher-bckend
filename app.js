// app.js - UPDATED
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const matchRoutes = require("./routes/matchRoutes");
const authRoutes = require("./authRoutes");
const advisorRoutes = require("./routes/advisorRoutes"); // ADD THIS
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000",
      "https://your-frontend-app.vercel.app" // ← YOUR ACTUAL FRONTEND URL
    ];
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  credentials: true
}));
// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.method === "POST") {
    console.log("📦 Body:", JSON.stringify(req.body));
  }
  next();
});

// ==================== DATABASE CONNECTION ====================
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) =>
    console.error("❌ MongoDB Connection Failed:", err.message)
  );

// ==================== ROUTES ====================

// 🔐 AUTH ROUTES (Unified Register + Login)
app.use("/api/auth", authRoutes);

// 👨‍🎓 Student registration → POST /api/students/register
app.use("/api/students", authRoutes);

// 👨‍🏫 Advisor registration → POST /api/advisors/register
app.use("/api/advisors", authRoutes);

// 🔍 Matching routes
app.use("/api/match", matchRoutes);

// 👨‍🏫 ADVISOR ROUTES - ADD THIS
app.use("/api/advisors", advisorRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";

  res.json({
    status: "Server running",
    database: dbStatus,
    timestamp: new Date().toISOString(),
    endpoints: {
      studentRegister: "POST /api/students/register",
      advisorRegister: "POST /api/advisors/register",
      unifiedRegister: "POST /api/auth/register",
      login: "POST /api/auth/login",
      advisorProfile: "POST /api/advisors/profile",
      advisorDashboard: "GET /api/advisors/dashboard"
    },
  });
});

// Get port from environment variable or use 5000
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;