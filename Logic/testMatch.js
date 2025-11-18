// Logic/testMatch.js
const matchStudentsToAdvisors = require("./matcher");
const students = require("../data/student");
const advisors = require("../data/advisors");

// Before matching
console.log("=== ADVISORS BEFORE MATCHING ===");
console.table(advisors.map(({ id, name, currentLoad, maxCapacity }) => ({
  id,
  name,
  currentLoad,
  maxCapacity,
})));

// Perform matching
const results = matchStudentsToAdvisors(students, advisors);

// After matching
console.log("\n=== MATCH RESULTS ===");
console.log(JSON.stringify(results, null, 2));

console.log("\n=== ADVISORS AFTER MATCHING ===");
console.table(advisors.map(({ id, name, currentLoad, maxCapacity }) => ({
  id,
  name,
  currentLoad,
  maxCapacity,
})));
