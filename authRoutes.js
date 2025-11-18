const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { JWT_SECRET } = require('./authMiddleware');
const User = require('./models/User');
const Student = require('./models/Student');
const Advisor = require('./models/Advisor');

/*
  ===========================================================
  UNIFIED REGISTRATION
  Endpoint: POST /api/auth/register
  ===========================================================
*/
router.post('/register', async (req, res) => {
  try {
    const { name, identifier, password, role, department } = req.body;

    // Validate fields
    if (!name || !identifier || !password || !role) {
      return res.status(400).json({ message: "All fields are required: name, identifier, password, role" });
    }

    if (!['student', 'advisor'].includes(role)) {
      return res.status(400).json({ message: "Role must be either 'student' or 'advisor'" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ identifier });
    if (existingUser) {
      return res.status(400).json({ message: `${role === 'student' ? 'Student' : 'Advisor'} already exists with this identifier` });
    }

    // Create user
    const user = new User({ name, identifier, password, role });
    await user.save();

    // Create role-specific profile
    if (role === 'student') {
      const student = new Student({
        userId: user._id,
        registrationNumber: identifier,
        researchInterests: [],
        careerGoals: "",
        preferredAdvisorTypes: [],
        hasMatched: false
      });
      await student.save();
    } if (role === 'advisor') {
  const advisor = new Advisor({
    userId: user._id,
    name: user.name,
    email: user.identifier,
    staffNumber: user.identifier,
    researchInterests: [],
    expertiseAreas: [],
    department: department || '',
    maxStudents: 5,
    availableSlots: 5,
    bio: '',
    completedProfile: false
  });
  await advisor.save();
  console.log("✅ Basic advisor profile created for:", user.name);
}

    // Generate token
    const token = jwt.sign({ userId: user._id, identifier: user.identifier, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        identifier: user.identifier,
        role: user.role
      }
    });

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

/*
  ===========================================================
  LOGIN
  Endpoint: POST /api/auth/login
  ===========================================================
*/
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier and password are required" });
    }

    const user = await User.findOne({ identifier });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ message: "Invalid credentials" });

    if (role && user.role !== role) {
      return res.status(401).json({ message: `This account is not a ${role}` });
    }

    let profileData = {};
    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user._id });
      profileData.hasMatched = student ? student.hasMatched : false;
    } else if (user.role === 'advisor') {
      const advisor = await Advisor.findOne({ userId: user._id });
      profileData.department = advisor ? advisor.department : '';
      profileData.researchAreas = advisor ? advisor.researchAreas : [];
    }

    const token = jwt.sign({ userId: user._id, identifier: user.identifier, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.json({ success: true, token, user: { id: user._id, name: user.name, identifier: user.identifier, role: user.role, ...profileData } });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

/*
  ===========================================================
  HEALTH CHECK
  Endpoint: GET /api/auth/health
  ===========================================================
*/
router.get('/health', async (req, res) => {
  try {
    const users = await User.countDocuments();
    const students = await Student.countDocuments();
    const advisors = await Advisor.countDocuments();
    res.json({ status: "Auth Service Running", users, students, advisors, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: "Auth Service Error", error: err.message });
  }
});

module.exports = router;
