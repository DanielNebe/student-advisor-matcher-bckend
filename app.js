// app.js 
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require('bcrypt');
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

// Import YOUR models
const User = require('./models/User');

// Basic routes
app.get("/", (req, res) => {
  console.log("📨 GET / request received");
  res.json({ 
    message: "Student Advisor Matcher API",
    status: "Running",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
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

// ==================== AUTHENTICATION ROUTES ====================

// User Registration - USING DIRECT MONGODB
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, identifier, password, role } = req.body;
    console.log("Registration attempt:", { name, identifier, role });
    
    const db = mongoose.connection.db;
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ identifier });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this identifier" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      name,
      identifier,
      password: hashedPassword,
      role,
      createdAt: new Date()
    };

    const userResult = await db.collection('users').insertOne(userData);
    const newUser = { _id: userResult.insertedId, ...userData };
    console.log("✅ User created:", newUser._id);

    // Create role-specific profile
    if (role === 'student') {
      const studentData = {
        userId: newUser._id,
        researchInterests: [],
        careerGoals: [],
        preferredAdvisorTypes: [],
        yearLevel: "",
        completedProfile: false,
        hasMatched: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('students').insertOne(studentData);
      console.log("✅ Student profile created");
      
    } else if (role === 'advisor') {
      const advisorData = {
        userId: newUser._id,
        name: name,
        email: identifier,
        staffNumber: identifier,
        researchInterests: [],
        expertiseAreas: [],
        department: "Computer Science",
        maxStudents: 5,
        availableSlots: 5,
        bio: "",
        completedProfile: false,
        matchedStudents: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('advisors').insertOne(advisorData);
      console.log("✅ Advisor profile created");
    }

    // Return success
    res.json({
      success: true,
      token: "jwt-token-" + newUser._id,
      user: { 
        name, 
        identifier, 
        role,
        id: newUser._id
      },
      message: "Registration successful! Please complete your profile."
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during registration: " + error.message 
    });
  }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password, role } = req.body;
    console.log("Login attempt:", { identifier, role });
    
    const db = mongoose.connection.db;
    
    // Find user by identifier
    const user = await db.collection('users').findOne({ identifier });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (isPasswordValid && user.role === role) {
      res.json({
        success: true,
        token: "jwt-token-" + user._id,
        user: {
          id: user._id,
          name: user.name,
          identifier: user.identifier,
          role: user.role
        },
        message: "Login successful!"
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error during login: " + error.message 
    });
  }
});

// ==================== STUDENT ROUTES ====================

// Complete Student Profile
app.post("/api/students/complete-profile", async (req, res) => {
  try {
    const { researchInterests, careerGoals, yearLevel, preferredAdvisorTypes } = req.body;
    
    // Get user ID from token
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const result = await db.collection('students').findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          researchInterests,
          careerGoals,
          yearLevel,
          preferredAdvisorTypes,
          completedProfile: true,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    res.json({
      success: true,
      student: result.value,
      message: "Student profile completed successfully!"
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Get Student Profile
app.get("/api/students/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const studentProfile = await db.collection('students').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    const user = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId(userId) 
    });

    res.json({
      success: true,
      student: {
        ...studentProfile,
        user: user ? { name: user.name, identifier: user.identifier } : null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Student Dashboard
app.get("/api/students/dashboard", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const studentProfile = await db.collection('students').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    const user = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId(userId) 
    });

    // Check if student has matches
    const matches = await db.collection('matches').find({ 
      studentId: studentProfile._id 
    }).toArray();

    let matchedAdvisor = null;
    if (matches.length > 0) {
      const advisor = await db.collection('advisors').findOne({ 
        _id: matches[0].advisorId 
      });
      const advisorUser = advisor ? await db.collection('users').findOne({ 
        _id: advisor.userId 
      }) : null;
      
      matchedAdvisor = {
        name: advisorUser?.name,
        researchAreas: advisor?.expertiseAreas,
        email: advisor?.email,
        department: advisor?.department
      };
    }

    res.json({
      profile: {
        name: user?.name,
        completedProfile: studentProfile.completedProfile,
        researchInterests: studentProfile.researchInterests,
        careerGoals: studentProfile.careerGoals,
        yearLevel: studentProfile.yearLevel
      },
      matchStatus: {
        hasMatched: matches.length > 0,
        matchDate: matches.length > 0 ? matches[0].timestamp : null,
        matchedAdvisor: matchedAdvisor
      },
      statistics: {
        totalMatches: matches.length,
        pendingMatches: matches.filter(m => m.status === 'pending').length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// ==================== ADVISOR ROUTES ====================

// Complete Advisor Profile
app.post("/api/advisors/complete-profile", async (req, res) => {
  try {
    const { researchInterests, expertiseAreas, maxStudents, availableSlots, bio } = req.body;
    
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const result = await db.collection('advisors').findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          researchInterests,
          expertiseAreas,
          maxStudents,
          availableSlots,
          bio,
          completedProfile: true,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    res.json({
      success: true,
      advisor: result.value,
      message: "Advisor profile completed successfully!"
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Get Advisor Profile - BOTH POST AND GET
app.post("/api/advisors/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const advisorProfile = await db.collection('advisors').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });

    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    const user = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId(userId) 
    });

    res.json({
      success: true,
      advisor: {
        ...advisorProfile,
        user: user ? { name: user.name, identifier: user.identifier } : null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Also keep GET version for compatibility
app.get("/api/advisors/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const advisorProfile = await db.collection('advisors').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });

    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    const user = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId(userId) 
    });

    res.json({
      success: true,
      advisor: {
        ...advisorProfile,
        user: user ? { name: user.name, identifier: user.identifier } : null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Advisor Dashboard
app.get("/api/advisors/dashboard", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const advisorProfile = await db.collection('advisors').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });

    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    const user = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId(userId) 
    });

    // Get advisor's matches and students
    const matches = await db.collection('matches').find({ 
      advisorId: advisorProfile._id 
    }).toArray();

    // Get student details for each match
    const students = await Promise.all(matches.map(async (match) => {
      const student = await db.collection('students').findOne({ 
        _id: match.studentId 
      });
      const studentUser = student ? await db.collection('users').findOne({ 
        _id: student.userId 
      }) : null;
      
      return {
        _id: student?._id,
        name: studentUser?.name,
        identifier: studentUser?.identifier,
        researchInterests: student?.researchInterests,
        yearLevel: student?.yearLevel,
        matchDate: match.timestamp,
        status: match.status
      };
    }));

    res.json({
      profile: {
        name: user?.name,
        researchAreas: advisorProfile.expertiseAreas,
        completedProfile: advisorProfile.completedProfile,
        department: advisorProfile.department,
        bio: advisorProfile.bio
      },
      statistics: {
        totalStudents: students.length,
        availableSlots: Math.max(0, advisorProfile.maxStudents - students.length),
        maxStudents: advisorProfile.maxStudents,
        utilizationRate: advisorProfile.maxStudents > 0 ? 
          Math.round((students.length / advisorProfile.maxStudents) * 100) : 0
      },
      students: students
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// ==================== MATCHING ROUTES ====================

// Find Match for Student
app.post("/api/match/find-match", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    // Get student profile
    const student = await db.collection('students').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });
    
    if (!student || !student.completedProfile) {
      return res.status(400).json({
        success: false,
        message: "Please complete your profile first"
      });
    }

    // Find compatible advisors
    const advisors = await db.collection('advisors').find({
      completedProfile: true,
      expertiseAreas: { $in: student.researchInterests },
      availableSlots: { $gt: 0 }
    }).toArray();

    if (advisors.length === 0) {
      return res.json({
        success: false,
        message: "No compatible advisors found at this time",
        reason: "No advisors match your research interests or all are at full capacity",
        details: {
          totalAdvisors: 0,
          yourInterests: student.researchInterests
        }
      });
    }

    // For now, pick the first compatible advisor
    const matchedAdvisor = advisors[0];

    // Get advisor user info
    const advisorUser = await db.collection('users').findOne({ 
      _id: matchedAdvisor.userId 
    });

    // Create match record
    const matchData = {
      studentId: student._id,
      advisorId: matchedAdvisor._id,
      matchReason: `Shared interests: ${student.researchInterests.filter(interest => 
        matchedAdvisor.expertiseAreas.includes(interest)
      ).join(', ')}`,
      matchScore: 85,
      status: 'pending',
      timestamp: new Date()
    };
    await db.collection('matches').insertOne(matchData);

    // Update advisor's available slots
    await db.collection('advisors').updateOne(
      { _id: matchedAdvisor._id },
      { $inc: { availableSlots: -1 } }
    );

    // Update student's match status
    await db.collection('students').updateOne(
      { _id: student._id },
      { 
        $set: { 
          hasMatched: true,
          matchedAdvisor: matchedAdvisor._id,
          matchDate: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: "Match found successfully!",
      matchedAdvisor: {
        name: advisorUser?.name,
        researchAreas: matchedAdvisor.expertiseAreas,
        email: matchedAdvisor.email,
        department: matchedAdvisor.department,
        bio: matchedAdvisor.bio
      },
      matchDetails: {
        sharedInterests: student.researchInterests.filter(interest => 
          matchedAdvisor.expertiseAreas.includes(interest)
        ),
        matchScore: 85
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Matching failed: " + error.message 
    });
  }
});

// Get All Advisors (for student browsing)
app.get("/api/advisors", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    const advisors = await db.collection('advisors').find({ 
      completedProfile: true 
    }).toArray();

    // Get user info for each advisor
    const advisorsWithUsers = await Promise.all(advisors.map(async (advisor) => {
      const user = await db.collection('users').findOne({ 
        _id: advisor.userId 
      });
      return {
        name: user?.name,
        researchAreas: advisor.expertiseAreas,
        department: advisor.department,
        availableSlots: advisor.availableSlots,
        maxCapacity: advisor.maxStudents,
        bio: advisor.bio,
        completedProfile: advisor.completedProfile
      };
    }));

    res.json({
      success: true,
      advisors: advisorsWithUsers
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// ==================== COMPATIBILITY ROUTES ====================

// Legacy routes for compatibility with frontend
app.post("/api/match/complete-profile", async (req, res) => {
  try {
    const { researchInterests, careerGoals, yearLevel } = req.body;
    
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const result = await db.collection('students').findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          researchInterests: researchInterests,
          careerGoals: careerGoals,
          yearLevel: yearLevel,
          completedProfile: true,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    res.json({
      success: true,
      student: {
        researchInterests: result.value?.researchInterests,
        careerGoals: result.value?.careerGoals,
        yearLevel: result.value?.yearLevel,
        completedProfile: result.value?.completedProfile
      },
      message: "Profile completed successfully!"
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Legacy student profile route
app.get("/api/match/student/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const studentProfile = await db.collection('students').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });
    
    if (!studentProfile) {
      return res.json({
        researchInterests: [],
        careerGoals: [],
        yearLevel: "",
        completedProfile: false
      });
    }

    res.json({
      researchInterests: studentProfile.researchInterests || [],
      careerGoals: studentProfile.careerGoals || [],
      yearLevel: studentProfile.yearLevel || "",
      completedProfile: studentProfile.completedProfile || false
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Legacy student dashboard route
app.get("/api/match/student/dashboard", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = authHeader ? authHeader.replace('Bearer jwt-token-', '') : null;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    const db = mongoose.connection.db;
    
    const studentProfile = await db.collection('students').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });
    
    const user = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId(userId) 
    });

    const matches = await db.collection('matches').find({ 
      studentId: studentProfile?._id 
    }).toArray();

    let matchedAdvisor = null;
    if (matches.length > 0) {
      const advisor = await db.collection('advisors').findOne({ 
        _id: matches[0].advisorId 
      });
      const advisorUser = advisor ? await db.collection('users').findOne({ 
        _id: advisor.userId 
      }) : null;
      
      matchedAdvisor = {
        name: advisorUser?.name || "Advisor",
        researchAreas: advisor?.expertiseAreas || [],
        email: advisor?.email || "",
        department: advisor?.department || ""
      };
    }

    res.json({
      profile: {
        completedProfile: studentProfile?.completedProfile || false,
        researchInterests: studentProfile?.researchInterests || [],
        careerGoals: studentProfile?.careerGoals || [],
        yearLevel: studentProfile?.yearLevel || ""
      },
      matchStatus: {
        hasMatched: matches.length > 0,
        matchDate: matches.length > 0 ? matches[0].timestamp : null,
        matchedAdvisor: matchedAdvisor
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==================== DEBUG ROUTES ====================

app.get("/api/debug-check", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    const advisors = await db.collection('advisors').find().toArray();
    const users = await db.collection('users').find().toArray();
    const students = await db.collection('students').find().toArray();
    const matches = await db.collection('matches').find().toArray();

    res.json({
      totalAdvisors: advisors.length,
      totalUsers: users.length,
      totalStudents: students.length,
      totalMatches: matches.length,
      advisors: advisors,
      users: users
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

console.log("🔧 All routes initialized");

module.exports = app;
