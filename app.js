// app.js 
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

// Import models
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

// User Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, identifier, password, role, email } = req.body;
    console.log("Registration attempt:", { name, identifier, role, email });
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: email || `${identifier}@university.edu` },
        { matric_no: role === 'student' ? identifier : null },
        { staff_id: role === 'advisor' ? identifier : null }
      ].filter(condition => condition !== null)
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this email or identifier" 
      });
    }

    // Create user based on role
    let userData = {
      name,
      email: email || `${identifier}@university.edu`,
      password, // In production, hash this with bcrypt!
      role
    };

    // Add identifier based on role
    if (role === 'student') {
      userData.matric_no = identifier;
    } else if (role === 'advisor') {
      userData.staff_id = identifier;
    }

    const newUser = new User(userData);
    await newUser.save();

    // Create role-specific profile
    if (role === 'student') {
      const studentProfile = new Student({
        user_id: newUser._id,
        department: "To be completed",
        academic_level: "To be completed"
      });
      await studentProfile.save();
    } else if (role === 'advisor') {
      const advisorProfile = new Advisor({
        user_id: newUser._id,
        department: "To be completed"
      });
      await advisorProfile.save();
    }

    res.json({
      success: true,
      token: "jwt-token-" + newUser._id, // Use proper JWT in production
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        identifier: identifier
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
    
    // Find user by identifier (matric_no, staff_id, or email)
    const user = await User.findOne({
      $or: [
        { matric_no: identifier },
        { staff_id: identifier },
        { email: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check password (in production, use bcrypt.compare)
    if (password === user.password) {
      res.json({
        success: true,
        token: "jwt-token-" + user._id,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          identifier: user.matric_no || user.staff_id
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
    const { department, academic_level, career_goals, research_interests, preferred_adviser_attributes } = req.body;
    
    // In production, get user_id from JWT token
    const user_id = req.headers.user_id || "mock_user_id"; // Replace with actual token verification
    
    const studentProfile = await Student.findOneAndUpdate(
      { user_id: user_id },
      {
        department,
        academic_level,
        career_goals,
        research_interests,
        preferred_adviser_attributes,
        completed_profile: true
      },
      { new: true, upsert: true }
    );

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
    const user_id = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ user_id: user_id })
      .populate('user_id', 'name email matric_no');
    
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
    const user_id = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ user_id: user_id })
      .populate('user_id', 'name email');
    
    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    // Check if student has matches
    const matches = await Match.find({ student_id: studentProfile._id })
      .populate('advisor_id')
      .populate('advisor_id.user_id', 'name email');

    res.json({
      profile: {
        name: studentProfile.user_id.name,
        completed_profile: studentProfile.completed_profile,
        research_interests: studentProfile.research_interests,
        career_goals: studentProfile.career_goals,
        academic_level: studentProfile.academic_level,
        department: studentProfile.department
      },
      match_status: {
        has_matched: matches.length > 0,
        match_date: matches.length > 0 ? matches[0].timestamp : null,
        matched_advisor: matches.length > 0 ? {
          name: matches[0].advisor_id.user_id.name,
          research_areas: matches[0].advisor_id.expertise_areas,
          email: matches[0].advisor_id.user_id.email,
          department: matches[0].advisor_id.department
        } : null
      },
      statistics: {
        total_matches: matches.length,
        pending_matches: matches.filter(m => m.status === 'pending').length
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
    const { department, expertise_areas, max_advisee_capacity, advising_style, bio } = req.body;
    
    const user_id = req.headers.user_id || "mock_user_id";
    
    const advisorProfile = await Advisor.findOneAndUpdate(
      { user_id: user_id },
      {
        department,
        expertise_areas,
        max_advisee_capacity,
        advising_style,
        bio,
        completed_profile: true
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      advisor: advisorProfile,
      message: "Advisor profile completed successfully!"
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error: " + error.message 
    });
  }
});

// Get Advisor Profile
app.get("/api/advisors/profile", async (req, res) => {
  try {
    const user_id = req.headers.user_id || "mock_user_id";
    
    const advisorProfile = await Advisor.findOne({ user_id: user_id })
      .populate('user_id', 'name email staff_id');
    
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
    const user_id = req.headers.user_id || "mock_user_id";
    
    const advisorProfile = await Advisor.findOne({ user_id: user_id })
      .populate('user_id', 'name email');
    
    if (!advisorProfile) {
      return res.status(404).json({
        success: false,
        message: "Advisor profile not found"
      });
    }

    // Get advisor's matches and students
    const matches = await Match.find({ advisor_id: advisorProfile._id })
      .populate('student_id')
      .populate('student_id.user_id', 'name email matric_no');

    const students = matches.map(match => ({
      _id: match.student_id._id,
      name: match.student_id.user_id.name,
      email: match.student_id.user_id.email,
      matric_no: match.student_id.user_id.matric_no,
      research_interests: match.student_id.research_interests,
      academic_level: match.student_id.academic_level,
      match_date: match.timestamp,
      status: match.status
    }));

    res.json({
      profile: {
        name: advisorProfile.user_id.name,
        research_areas: advisorProfile.expertise_areas,
        completed_profile: advisorProfile.completed_profile,
        department: advisorProfile.department,
        bio: advisorProfile.bio
      },
      statistics: {
        total_students: students.length,
        available_slots: Math.max(0, advisorProfile.max_advisee_capacity - students.length),
        max_students: advisorProfile.max_advisee_capacity,
        utilization_rate: advisorProfile.max_advisee_capacity > 0 ? 
          Math.round((students.length / advisorProfile.max_advisee_capacity) * 100) : 0
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
    const user_id = req.headers.user_id || "mock_user_id";
    
    // Get student profile
    const student = await Student.findOne({ user_id: user_id });
    if (!student || !student.completed_profile) {
      return res.status(400).json({
        success: false,
        message: "Please complete your profile first"
      });
    }

    // Find compatible advisors
    const advisors = await Advisor.find({
      completed_profile: true,
      expertise_areas: { $in: student.research_interests },
      current_advisees: { $lt: '$max_advisee_capacity' }
    }).populate('user_id', 'name email');

    if (advisors.length === 0) {
      return res.json({
        success: false,
        message: "No compatible advisors found at this time",
        reason: "No advisors match your research interests or all are at full capacity",
        details: {
          total_advisors: 0,
          your_interests: student.research_interests
        }
      });
    }

    // For now, pick the first compatible advisor
    const matchedAdvisor = advisors[0];

    // Create match record
    const newMatch = new Match({
      student_id: student._id,
      advisor_id: matchedAdvisor._id,
      match_reason: `Shared interests: ${student.research_interests.filter(interest => 
        matchedAdvisor.expertise_areas.includes(interest)
      ).join(', ')}`,
      match_score: 85, // Calculate based on shared interests
      status: 'pending'
    });
    await newMatch.save();

    // Update advisor's current advisee count
    await Advisor.findByIdAndUpdate(matchedAdvisor._id, {
      $inc: { current_advisees: 1 }
    });

    res.json({
      success: true,
      message: "Match found successfully!",
      matched_advisor: {
        name: matchedAdvisor.user_id.name,
        research_areas: matchedAdvisor.expertise_areas,
        email: matchedAdvisor.user_id.email,
        department: matchedAdvisor.department,
        bio: matchedAdvisor.bio
      },
      match_details: {
        shared_interests: student.research_interests.filter(interest => 
          matchedAdvisor.expertise_areas.includes(interest)
        ),
        match_score: 85
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
    const advisors = await Advisor.find({ completed_profile: true })
      .populate('user_id', 'name email')
      .select('expertise_areas department max_advisee_capacity current_advisees bio');

    res.json({
      success: true,
      advisors: advisors.map(advisor => ({
        name: advisor.user_id.name,
        research_areas: advisor.expertise_areas,
        department: advisor.department,
        available_slots: Math.max(0, advisor.max_advisee_capacity - advisor.current_advisees),
        max_capacity: advisor.max_advisee_capacity,
        bio: advisor.bio,
        completed_profile: advisor.completed_profile
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
    
    const user_id = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOneAndUpdate(
      { user_id: user_id },
      {
        research_interests: researchInterests,
        career_goals: careerGoals,
        academic_level: yearLevel,
        completed_profile: true
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      student: {
        researchInterests: studentProfile.research_interests,
        careerGoals: studentProfile.career_goals,
        yearLevel: studentProfile.academic_level,
        completedProfile: studentProfile.completed_profile
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
    const user_id = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ user_id: user_id });
    
    if (!studentProfile) {
      return res.json({
        researchInterests: [],
        careerGoals: [],
        yearLevel: "",
        completedProfile: false
      });
    }

    res.json({
      researchInterests: studentProfile.research_interests || [],
      careerGoals: studentProfile.career_goals || [],
      yearLevel: studentProfile.academic_level || "",
      completedProfile: studentProfile.completed_profile || false
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Legacy student dashboard route
app.get("/api/match/student/dashboard", async (req, res) => {
  try {
    const user_id = req.headers.user_id || "mock_user_id";
    
    const studentProfile = await Student.findOne({ user_id: user_id })
      .populate('user_id', 'name');
    
    const matches = await Match.find({ 
      student_id: studentProfile?._id 
    }).populate('advisor_id');

    res.json({
      profile: {
        completedProfile: studentProfile?.completed_profile || false,
        researchInterests: studentProfile?.research_interests || [],
        careerGoals: studentProfile?.career_goals || [],
        yearLevel: studentProfile?.academic_level || ""
      },
      matchStatus: {
        hasMatched: matches.length > 0,
        matchDate: matches.length > 0 ? matches[0].timestamp : null,
        matchedAdvisor: matches.length > 0 ? {
          name: matches[0].advisor_id.user_id?.name || "Advisor",
          researchAreas: matches[0].advisor_id.expertise_areas || [],
          email: matches[0].advisor_id.user_id?.email || "",
          department: matches[0].advisor_id.department || ""
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

console.log("🔧 All routes initialized");

module.exports = app;
