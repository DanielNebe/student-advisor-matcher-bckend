const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  advisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor', required: true },
  match_reason: { type: String },
  match_score: { type: Number },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
