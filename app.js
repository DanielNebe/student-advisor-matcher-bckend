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

// Add proper registration route
const User = require('./models/User'); // Make sure this model exists

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, identifier, password, role } = req.body;
    console.log("Registration attempt:", { name, identifier, role });
    
    // Check if user already exists
    const existingUser = await User.findOne({ identifier });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this registration number" 
      });
    }
    
    // Create new user (you'll need proper password hashing)
    const newUser = new User({
      name,
      identifier, 
      password, // You should hash this!
      role
    });
    
    await newUser.save();
    
    // Return success
    res.json({
      success: true,
      token: "real-token-" + Date.now(), // You should use JWT here
      user: { 
        name, 
        identifier, 
        role,
        id: newUser._id
      },
      message: "Registration successful!"
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during registration" 
    });
  }
});

module.exports = app;
