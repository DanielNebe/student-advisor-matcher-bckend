const mongoose = require('mongoose');

// models/Student.js - ensure this field exists
const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  researchInterests: [String],
  careerGoals: [String],
  preferredAdvisorTypes: [String],
  yearLevel: String, // Make sure this field exists
  completedProfile: { type: Boolean, default: false },
  hasMatched: { type: Boolean, default: false },
  matchedAdvisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor' },
  matchDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);