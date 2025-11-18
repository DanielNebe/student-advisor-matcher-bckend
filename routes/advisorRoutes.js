// routes/advisorRoutes.js - DEPARTMENT REMOVED
const express = require("express");
const router = express.Router();
const { authenticateToken } = require('../authMiddleware');
const Advisor = require('../models/Advisor');
const Student = require('../models/Student');
const User = require('../models/User');

// Get advisor profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    console.log("🔍 Fetching advisor profile for user:", req.user.userId);
    
    const advisor = await Advisor.findOne({ userId: req.user.userId });
    
    if (!advisor) {
      console.log("❌ No advisor profile found for user:", req.user.userId);
      return res.status(404).json({ message: 'Advisor profile not found. Please complete your profile.' });
    }
    
    console.log("✅ Advisor profile found:", advisor._id);
    res.json(advisor);
  } catch (error) {
    console.error('❌ Error fetching advisor profile:', error);
    res.status(500).json({ message: 'Error fetching advisor profile', error: error.message });
  }
});

// Create or update advisor profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    console.log("📝 Saving advisor profile for user:", req.user.userId);
    console.log("📦 Profile data:", req.body);
    
    const { researchInterests, expertiseAreas, maxStudents, availableSlots, bio, completedProfile } = req.body;
    
    // Get user details
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    let advisor = await Advisor.findOne({ userId: req.user.userId });
    
    if (!advisor) {
      console.log("🆕 Creating new advisor profile");
      advisor = new Advisor({ 
        userId: req.user.userId,
        name: user.name,
        email: user.identifier,
        staffNumber: user.identifier,
        researchInterests: researchInterests || [],
        expertiseAreas: expertiseAreas || [],
        maxStudents: maxStudents || 5,
        availableSlots: availableSlots || 5,
        bio: bio || '',
        completedProfile: completedProfile || false
      });
    } else {
      console.log("📋 Updating existing advisor profile");
      // Update fields (department removed)
      if (researchInterests) advisor.researchInterests = researchInterests;
      if (expertiseAreas) advisor.expertiseAreas = expertiseAreas;
      if (maxStudents !== undefined) advisor.maxStudents = maxStudents;
      if (availableSlots !== undefined) advisor.availableSlots = availableSlots;
      if (bio !== undefined) advisor.bio = bio;
      if (completedProfile !== undefined) advisor.completedProfile = completedProfile;
    }
    
    await advisor.save();
    console.log("✅ Advisor profile saved successfully");
    
    res.json({ 
      success: true,
      message: 'Advisor profile saved successfully', 
      advisor 
    });
    
  } catch (error) {
    console.error('❌ Error saving advisor profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error saving advisor profile', 
      error: error.message 
    });
  }
});

// Get advisor dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log("📊 Fetching advisor dashboard for user:", req.user.userId);
    
    const advisor = await Advisor.findOne({ userId: req.user.userId });
    
    if (!advisor) {
      console.log("❌ No advisor profile found for dashboard");
      return res.status(404).json({ 
        success: false,
        message: 'Advisor profile not found. Please complete your profile first.' 
      });
    }
    
    // Get matched students
    const matchedStudents = await Student.find({ 
      matchedAdvisor: advisor._id 
    }).populate('userId', 'name email');
    
    const dashboardData = {
      success: true,
      profile: {
        name: advisor.name,
        email: advisor.email,
        researchInterests: advisor.researchInterests,
        expertiseAreas: advisor.expertiseAreas,
        bio: advisor.bio,
        availableSlots: advisor.availableSlots,
        maxStudents: advisor.maxStudents,
        completedProfile: advisor.completedProfile
      },
      students: matchedStudents.map(student => ({
        _id: student._id,
        name: student.userId?.name || 'Unknown Student',
        email: student.userId?.email || 'No email',
        researchInterests: student.researchInterests,
        careerGoals: student.careerGoals,
        yearLevel: student.yearLevel,
        matchDate: student.matchDate
      })),
      statistics: {
        totalStudents: matchedStudents.length,
        availableSlots: advisor.availableSlots,
        maxStudents: advisor.maxStudents,
        utilizationRate: advisor.maxStudents > 0 ? ((matchedStudents.length / advisor.maxStudents) * 100).toFixed(1) : '0'
      }
    };
    
    console.log("✅ Dashboard data sent for advisor:", advisor.name);
    res.json(dashboardData);
  } catch (error) {
    console.error('❌ Error fetching advisor dashboard:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching dashboard', 
      error: error.message 
    });
  }
});

// Get advisor's matched students
router.get('/me/students', authenticateToken, async (req, res) => {
  try {
    const advisor = await Advisor.findOne({ userId: req.user.userId });
    
    if (!advisor) {
      return res.status(404).json({ message: 'Advisor profile not found' });
    }
    
    const matchedStudents = await Student.find({ 
      matchedAdvisor: advisor._id 
    }).populate('userId', 'name email');
    
    res.json({ 
      success: true,
      students: matchedStudents,
      totalStudents: matchedStudents.length,
      availableSlots: advisor.availableSlots,
      maxStudents: advisor.maxStudents
    });
    
  } catch (error) {
    console.error('Error fetching advisor students:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching students', 
      error: error.message 
    });
  }
});

// Update advisor availability
router.put('/availability', authenticateToken, async (req, res) => {
  try {
    const { availableSlots, maxStudents } = req.body;
    
    const advisor = await Advisor.findOne({ userId: req.user.userId });
    if (!advisor) {
      return res.status(404).json({ message: 'Advisor not found' });
    }
    
    if (availableSlots !== undefined) advisor.availableSlots = availableSlots;
    if (maxStudents !== undefined) advisor.maxStudents = maxStudents;
    
    await advisor.save();
    
    res.json({ 
      success: true,
      message: 'Availability updated successfully', 
      advisor 
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating availability', 
      error: error.message 
    });
  }
});

module.exports = router;