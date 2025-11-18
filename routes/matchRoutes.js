// routes/matchRoutes.js - FIXED FOR PRODUCTION
const express = require("express");
const router = express.Router();
const { authenticateToken } = require('../authMiddleware');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');

// REMOVED: Seed advisors route (temporary - remove in production)

// Batch matching route
router.get("/run", async (req, res) => {
  try {
    const students = await Student.find();
    const advisors = await Advisor.find();

    if (students.length === 0 || advisors.length === 0) {
      return res.status(404).json({ message: "Students or advisors not found in database" });
    }

    // FIX: Add this simple matching function
    const matchStudentsToAdvisors = (students, advisors) => {
      const results = [];
      
      students.forEach(student => {
        if (!student.hasMatched) {
          // Find first available advisor with matching interests
          const matchedAdvisor = advisors.find(advisor => 
            advisor.availableSlots > 0 && 
            advisor.researchAreas.some(area => 
              student.researchInterests.includes(area)
            )
          );
          
          if (matchedAdvisor) {
            results.push({
              student: student.name || student.registrationNumber,
              advisor: matchedAdvisor.name,
              sharedInterests: matchedAdvisor.researchAreas.filter(area => 
                student.researchInterests.includes(area)
              )
            });
          }
        }
      });
      
      return results;
    };

    const results = matchStudentsToAdvisors(students, advisors);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error running matching algorithm:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Complete profile route
router.post('/complete-profile', authenticateToken, async (req, res) => {
  try {
    console.log('Received profile data:', req.body);
    
    const { researchInterests, careerGoals, yearLevel } = req.body;
    
    // Validate required fields
    if (!researchInterests || !careerGoals || !yearLevel) {
      return res.status(400).json({ 
        message: 'Missing required fields: researchInterests, careerGoals, and yearLevel are required' 
      });
    }
    
    let student = await Student.findOne({ userId: req.user.userId });
    
    if (!student) {
      student = new Student({ 
        userId: req.user.userId,
        researchInterests: [],
        careerGoals: [],
        preferredAdvisorTypes: []
      });
    }
    
    student.researchInterests = researchInterests;
    student.careerGoals = careerGoals;
    student.yearLevel = yearLevel;
    student.completedProfile = true;
    
    await student.save();
    
    console.log('Profile saved successfully for user:', req.user.userId);
    res.json({ message: 'Profile completed successfully', student });
    
  } catch (error) {
    console.error('Error completing profile:', error);
    res.status(500).json({ 
      message: 'Error completing profile',
      error: error.message
    });
  }
});

// Enhanced find match route with detailed no-advisor reasons
router.post('/find-match', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId })
      .populate('matchedAdvisor');
    
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found. Please complete your profile first.' });
    }
    
    // Check if already matched
    if (student.hasMatched && student.matchedAdvisor) {
      return res.status(400).json({ 
        message: 'You have already been matched with an advisor',
        matchedAdvisor: student.matchedAdvisor,
        alreadyMatched: true
      });
    }
    
    // Check if profile is completed
    if (!student.completedProfile) {
      return res.status(400).json({ 
        message: 'Please complete your profile before finding a match' 
      });
    }
    
    // Find compatible advisor based on research interests AND availability
    const compatibleAdvisors = await Advisor.find({
      researchAreas: { $in: student.researchInterests },
      availableSlots: { $gt: 0 }
    });

    console.log(`Found ${compatibleAdvisors.length} compatible advisors`);
    
    if (compatibleAdvisors.length === 0) {
      // Detailed reason analysis
      const allAdvisors = await Advisor.find({});
      const advisorsWithMatchingInterests = await Advisor.find({
        researchAreas: { $in: student.researchInterests }
      });
      
      let reason = '';
      
      if (allAdvisors.length === 0) {
        reason = 'No advisors are currently registered in the system.';
      } else if (advisorsWithMatchingInterests.length === 0) {
        reason = 'No advisors found matching your research interests.';
      } else {
        const availableMatchingAdvisors = await Advisor.find({
          researchAreas: { $in: student.researchInterests },
          availableSlots: { $gt: 0 }
        });
        
        if (availableMatchingAdvisors.length === 0) {
          reason = 'All advisors with matching research interests are currently at full capacity.';
        } else {
          reason = 'No available advisors found for your specific criteria.';
        }
      }
      
      return res.status(404).json({ 
        success: false,
        message: 'No compatible advisors available at this time',
        reason: reason,
        details: {
          totalAdvisors: allAdvisors.length,
          advisorsWithMatchingInterests: advisorsWithMatchingInterests.length,
          yourInterests: student.researchInterests
        },
        suggestion: 'Please check back later or contact administration for assistance.'
      });
    }
    
    // Select best match (simple first-match for now)
    const matchedAdvisor = compatibleAdvisors[0];
    
    // Update student record
    student.hasMatched = true;
    student.matchedAdvisor = matchedAdvisor._id;
    student.matchDate = new Date();
    await student.save();
    
    // Update advisor available slots
    matchedAdvisor.availableSlots -= 1;
    await matchedAdvisor.save();
    
    res.json({ 
      success: true,
      message: 'Successfully matched with an advisor!',
      matchedAdvisor: matchedAdvisor,
      matchDetails: {
        matchDate: student.matchDate,
        sharedInterests: matchedAdvisor.researchAreas.filter(area => 
          student.researchInterests.includes(area)
        )
      }
    });
    
  } catch (error) {
    console.error('Error finding match:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error finding match', 
      error: error.message 
    });
  }
});

// Get student profile
router.get('/student/profile', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.userId })
      .populate('matchedAdvisor');
    
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    
    res.json(student);
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ message: 'Error fetching student profile', error: error.message });
  }
});

// Enhanced student dashboard with statistics
router.get('/student/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log("📊 Dashboard endpoint hit for user:", req.user.userId);
    
    const student = await Student.findOne({ userId: req.user.userId })
      .populate('matchedAdvisor');
    
    if (!student) {
      console.log("❌ No student found for user:", req.user.userId);
      return res.status(404).json({ message: 'Student profile not found' });
    }
    
    console.log("✅ Student found:", student._id);
    
    // Get real statistics
    const totalAdvisors = await Advisor.countDocuments();
    const availableAdvisors = await Advisor.countDocuments({ availableSlots: { $gt: 0 } });
    const compatibleAdvisors = await Advisor.countDocuments({
      researchAreas: { $in: student.researchInterests || [] },
      availableSlots: { $gt: 0 }
    });
    
    const dashboardData = {
      profile: {
        researchInterests: student.researchInterests || [],
        careerGoals: student.careerGoals || [],
        yearLevel: student.yearLevel || 'Not set',
        preferredAdvisorTypes: student.preferredAdvisorTypes || [],
        completedProfile: student.completedProfile || false,
        profileCompletedAt: student.updatedAt
      },
      matchStatus: {
        hasMatched: student.hasMatched || false,
        matchedAdvisor: student.matchedAdvisor,
        matchDate: student.matchDate,
        canFindMatch: student.completedProfile && !student.hasMatched
      },
      statistics: {
        totalAdvisors: totalAdvisors,
        availableAdvisors: availableAdvisors,
        compatibleAdvisors: compatibleAdvisors,
        yourInterests: (student.researchInterests || []).length,
        yourGoals: (student.careerGoals || []).length
      }
    };
    
    console.log("📈 Sending dashboard data");
    res.json(dashboardData);
    
  } catch (error) {
    console.error('❌ Error in dashboard:', error);
    res.status(500).json({ 
      message: 'Error fetching dashboard data', 
      error: error.message 
    });
  }
});

module.exports = router;