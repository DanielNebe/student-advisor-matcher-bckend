// server.js - CLEANED UP
const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Add this to your server.js file (temporary - remove after seeding)
app.get('/seed-now', async (req, res) => {
  try {
    const Advisor = require('./models/Advisor');
    
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
