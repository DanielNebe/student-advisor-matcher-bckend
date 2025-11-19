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
const Student = require('./models/Student');
const Advisor = require('./models/Advisor');
const Match = require('./models/Match');

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

// User Registration - USING YOUR MODELS
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, identifier, password, role } = req.body;
    console.log("Registration attempt:", { name, identifier, role });
    
    // Check if user already exists
    const existingUser = await User.findOne({ identifier });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this identifier" 
      });
    }

    // Create user (password auto-hashed by your model's pre-save hook)
    const newUser = new User({
      name,
      identifier,
      password, // This will be auto-hashed by your pre-save hook
      role
    });
    
    await newUser.save();

    // Create role-specific profile using YOUR models
    if (role === 'student') {
      const studentProfile = new Student({
        userId: newUser._id,
        researchInterests: [],
        careerGoals: [],
        preferredAdvisorTypes: [],
        yearLevel: "",
        completedProfile: false,
        hasMatched: false
      });
      await studentProfile.save();
      console.log("✅ Student profile created");

      } else if (role === 'advisor') {
  // Get the database connection
  const db = mongoose.connection.db;
  
  // Create advisor document directly
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
  
  // Insert directly into advisors collection
  await db.collection('advisors').insertOne(advisorData);
  console.log("✅ Advisor profile created (direct insert)");
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
    
    // Find user by identifier
    const user = await User.findOne({ identifier });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check password using bcrypt (from your model)
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
    
    // In production, get user ID from JWT token
    const userId = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOneAndUpdate(
      { userId: userId },
      {
        researchInterests,
        careerGoals,
        yearLevel,
        preferredAdvisorTypes,
        completedProfile: true
      },
      { new: true }
    );

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    res.json({
      success: true,
      student: studentProfile,
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
    const userId = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ userId: userId })
      .populate('userId', 'name identifier');
    
    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    res.json({
      success: true,
      student: studentProfile
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
    const userId = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ userId: userId })
      .populate('userId', 'name');
    
    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    // Check if student has matches
    const matches = await Match.find({ studentId: studentProfile._id })
      .populate('advisorId')
      .populate('advisorId.userId', 'name');

    res.json({
      profile: {
        name: studentProfile.userId.name,
        completedProfile: studentProfile.completedProfile,
        researchInterests: studentProfile.researchInterests,
        careerGoals: studentProfile.careerGoals,
        yearLevel: studentProfile.yearLevel
      },
      matchStatus: {
        hasMatched: matches.length > 0,
        matchDate: matches.length > 0 ? matches[0].timestamp : null,
        matchedAdvisor: matches.length > 0 ? {
          name: matches[0].advisorId.userId.name,
          researchAreas: matches[0].advisorId.expertiseAreas,
          email: matches[0].advisorId.email,
          department: matches[0].advisorId.department
        } : null
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
// Add this route - it will handle both POST and GET for advisor profile
app.post("/api/advisors/profile", async (req, res) => {
  try {
    const userId = req.headers.user_id || req.headers.authorization?.replace('Bearer jwt-token-', '') || "mock_user_id";
    
    console.log("🔍 Looking for advisor profile for user:", userId);
    
    const db = mongoose.connection.db;
    
    const advisorProfile = await db.collection('advisors').findOne({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });

    console.log("🔍 Found advisor profile:", advisorProfile ? "Yes" : "No");

    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    // Also get user info
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
    console.error("❌ Advisor profile error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Also keep the GET version for compatibility
app.get("/api/advisors/profile", async (req, res) => {
  try {
    const userId = req.headers.user_id || "mock_user_id";
    
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
// Debug route to check what's in database
app.get("/api/debug-check", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    const advisors = await db.collection('advisors').find().toArray();
    const users = await db.collection('users').find().toArray();
    
    // Check if the specific user exists
    const specificUser = await db.collection('users').findOne({ 
      _id: new mongoose.Types.ObjectId("691d7e26e17ddbbe1c8bc290") 
    });
    
    const specificAdvisor = await db.collection('advisors').findOne({ 
      userId: new mongoose.Types.ObjectId("691d7e26e17ddbbe1c8bc290") 
    });

    res.json({
      totalAdvisors: advisors.length,
      totalUsers: users.length,
      specificUserExists: !!specificUser,
      specificAdvisorExists: !!specificAdvisor,
      specificUser: specificUser,
      specificAdvisor: specificAdvisor
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});
// Complete Advisor Profile
app.post("/api/advisors/complete-profile", async (req, res) => {
  try {
    const { researchInterests, expertiseAreas, maxStudents, availableSlots, bio } = req.body;
    
    const userId = req.headers.user_id || "mock_user_id";
    
    // Use direct MongoDB update instead of mongoose model
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

// Get Advisor Profile - CHANGED FROM GET TO POST
app.post("/api/advisors/profile", async (req, res) => {
  try {
    const userId = req.headers.user_id || "mock_user_id";
    
    // Use direct MongoDB find instead of mongoose
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

    // Also get user info
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
    const userId = req.headers.user_id || "mock_user_id";
    
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

    // Get user info
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

// Debug route to check advisors in database
app.get("/api/debug-advisors", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const advisors = await db.collection('advisors').find().toArray();
    const users = await db.collection('users').find().toArray();
    
    res.json({
      advisors: advisors,
      users: users,
      totalAdvisors: advisors.length,
      totalUsers: users.length
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});
// Get Advisor Profile
app.get("/api/advisors/profile", async (req, res) => {
  try {
    const userId = req.headers.user_id || "mock_user_id";
    
    const advisorProfile = await Advisor.findOne({ userId: userId })
      .populate('userId', 'name identifier');
    
    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    res.json({
      success: true,
      advisor: advisorProfile
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
    const userId = req.headers.user_id || "mock_user_id";
    
    const advisorProfile = await Advisor.findOne({ userId: userId })
      .populate('userId', 'name');
    
    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    // Get advisor's matches and students
    const matches = await Match.find({ advisorId: advisorProfile._id })
      .populate('studentId')
      .populate('studentId.userId', 'name identifier');

    const students = matches.map(match => ({
      _id: match.studentId._id,
      name: match.studentId.userId.name,
      identifier: match.studentId.userId.identifier,
      researchInterests: match.studentId.researchInterests,
      yearLevel: match.studentId.yearLevel,
      matchDate: match.timestamp,
      status: match.status
    }));

    res.json({
      profile: {
        name: advisorProfile.userId.name,
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
    const userId = req.headers.user_id || "mock_user_id";
    
    // Get student profile
    const student = await Student.findOne({ userId: userId });
    if (!student || !student.completedProfile) {
      return res.status(400).json({
        success: false,
        message: "Please complete your profile first"
      });
    }

    // Find compatible advisors
    const advisors = await Advisor.find({
      completedProfile: true,
      expertiseAreas: { $in: student.researchInterests },
      availableSlots: { $gt: 0 }
    }).populate('userId', 'name');

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

    // Create match record
    const newMatch = new Match({
      studentId: student._id,
      advisorId: matchedAdvisor._id,
      matchReason: `Shared interests: ${student.researchInterests.filter(interest => 
        matchedAdvisor.expertiseAreas.includes(interest)
      ).join(', ')}`,
      matchScore: 85, // Calculate based on shared interests
      status: 'pending'
    });
    await newMatch.save();

    // Update advisor's available slots
    await Advisor.findByIdAndUpdate(matchedAdvisor._id, {
      $inc: { availableSlots: -1 }
    });

    // Update student's match status
    await Student.findByIdAndUpdate(student._id, {
      hasMatched: true,
      matchedAdvisor: matchedAdvisor._id,
      matchDate: new Date()
    });

    res.json({
      success: true,
      message: "Match found successfully!",
      matchedAdvisor: {
        name: matchedAdvisor.userId.name,
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
    const advisors = await Advisor.find({ completedProfile: true })
      .populate('userId', 'name')
      .select('expertiseAreas department maxStudents availableSlots bio');

    res.json({
      success: true,
      advisors: advisors.map(advisor => ({
        name: advisor.userId.name,
        researchAreas: advisor.expertiseAreas,
        department: advisor.department,
        availableSlots: advisor.availableSlots,
        maxCapacity: advisor.maxStudents,
        bio: advisor.bio,
        completedProfile: advisor.completedProfile
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// ==================== COMPATIBILITY ROUTES (for old frontend) ====================

// Legacy routes for compatibility with existing frontend
app.post("/api/match/complete-profile", async (req, res) => {
  try {
    const { researchInterests, careerGoals, yearLevel } = req.body;
    
    const userId = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOneAndUpdate(
      { userId: userId },
      {
        researchInterests: researchInterests,
        careerGoals: careerGoals,
        yearLevel: yearLevel,
        completedProfile: true
      },
      { new: true }
    );

    res.json({
      success: true,
      student: {
        researchInterests: studentProfile.researchInterests,
        careerGoals: studentProfile.careerGoals,
        yearLevel: studentProfile.yearLevel,
        completedProfile: studentProfile.completedProfile
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
    const userId = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ userId: userId });
    
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
    const userId = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ userId: userId })
      .populate('userId', 'name');
    
    const matches = await Match.find({ 
      studentId: studentProfile?._id 
    }).populate('advisorId');

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
        matchedAdvisor: matches.length > 0 ? {
          name: matches[0].advisorId.userId?.name || "Advisor",
          researchAreas: matches[0].advisorId.expertiseAreas || [],
          email: matches[0].advisorId.email || "",
          department: matches[0].advisorId.department || ""
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
// test route to check if Advisor model works
app.get("/api/test-advisor", async (req, res) => {
  try {
    const Advisor = require('./models/Advisor');
    console.log("Advisor model:", Advisor);
    
    // Try to create a simple advisor
    const testAdvisor = new Advisor({
      userId: new mongoose.Types.ObjectId(),
      name: "Test Advisor",
      email: "test@test.com",
      staffNumber: "TEST001"
    });
    
    res.json({
      success: true,
      message: "Advisor model is working",
      isConstructor: typeof Advisor === 'function'
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Advisor model error: " + error.message
    });
  }
});

console.log("🔧 All routes initialized");

module.exports = app;
