// models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: String,
  academicField: String,
  researchInterests: [String],
});

module.exports = mongoose.model("Student", studentSchema);
