// app.js - COMPLETE UPDATED VERSION
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const matchRoutes = require("./routes/matchRoutes");
const authRoutes = require("./authRoutes");
const advisorRoutes = require("./routes/advisorRoutes");
require("dotenv").config();

const app = express();
app.use(express.json());

// ==================== SIMPLE CORS FIX ====================
app.use(cors({
  origin: "*", // Allow ALL origins - this will fix CORS immediately
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
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

// 👨‍🏫 ADVISOR ROUTES
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

// Root route for Railway
app.get("/", (req, res) => {
  res.json({ 
    message: "Student Advisor Matcher API",
    status: "Running",
    timestamp: new Date().toISOString()
  });
});

// ==================== SEEDING ROUTE ====================
const Advisor = require('./models/Advisor');

app.get('/seed-now', async (req, res) => {
  try {    
    // Clear existing advisors
    await Advisor.deleteMany({}); 
    
    // Create sample advisors
    const advisors = await Advisor.insertMany([
      {
        name: "Dr. Sarah Johnson",
        email: "sarah.johnson@university.edu",
        department: "Computer Science",
        researchAreas: ["Artificial Intelligence", "Machine Learning", "Data Science"],
        availableSlots: 3,
        maxStudents: 5
      },
      {
        name: "Prof. Michael Chen",
        email: "michael.chen@university.edu", 
        department: "Software Engineering",
        researchAreas: ["Software Engineering", "Web Development", "Cloud Computing"],
        availableSlots: 2,
        maxStudents: 4
      },
      {
        name: "Dr. Emily Davis",
        email: "emily.davis@university.edu",
        department: "Data Science",
        researchAreas: ["Data Science", "Machine Learning", "Natural Language Processing"],
        availableSlots: 1,
        maxStudents: 3
      }
    ]);
    
    console.log("✅ Advisors seeded successfully!");
    res.json({ 
      success: true,
      message: "Advisors seeded successfully!", 
      advisors: advisors 
    });
    
  } catch (error) {
    console.error('❌ Error seeding advisors:', error);
    res.status(500).json({ 
      success: false,
      message: "Error seeding advisors", 
      error: error.message 
    });
  }
});

module.exports = app;
