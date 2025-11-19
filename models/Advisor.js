// models/Advisor.js
const mongoose = require('mongoose');

const advisorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  email: String,
  staffNumber: String,
  researchInterests: [String],
  expertiseAreas: [String],
  department: { type: String, default: "Computer Science" },
  maxStudents: { type: Number, default: 5 },
  availableSlots: { type: Number, default: 5 },
  bio: String,
  completedProfile: { type: Boolean, default: false },
  matchedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
}, { timestamps: true });


module.exports = mongoose.model('Advisor', advisorSchema);
