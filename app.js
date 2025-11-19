// app.js - COMPLETE REPLACEMENT
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());

// CORS - Allow all origins
app.use(cors());

console.log("🔧 Starting server initialization...");

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Failed:", err));

// Basic routes
app.get("/", (req, res) => {
  console.log("📨 GET / request received");
  res.json({ 
    message: "Student Advisor Matcher API",
    status: "Running",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  console.log("📨 GET /health request received");
  res.json({
    status: "Server running",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get("/test", (req, res) => {
  console.log("📨 GET /test request received");
  res.json({ message: "Test route working!" });
});

console.log("🔧 Routes initialized");

module.exports = app;
