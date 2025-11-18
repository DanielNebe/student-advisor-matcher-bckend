// models/Advisor.js
const mongoose = require("mongoose");

const advisorSchema = new mongoose.Schema({
  name: String,
  specialization: String,
  researchFocus: [String],
  maxCapacity: { type: Number, default: 3 },
  currentLoad: { type: Number, default: 0 },
});

module.exports = mongoose.model("Advisor", advisorSchema);
