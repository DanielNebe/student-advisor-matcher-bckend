// Logic/matcher.js

function matchStudentsToAdvisors(students, advisors) {
  const matches = [];

  students.forEach((student) => {
    const advisorMatches = [];

    // Step 1️⃣ – Filter available advisors
    const availableAdvisors = advisors.filter(
      (advisor) => advisor.currentLoad < advisor.maxCapacity
    );

    if (availableAdvisors.length === 0) {
      console.log(`⚠️ No available advisors for ${student.name}`);
    }

    // Step 2️⃣ – Compute score for each available advisor
    availableAdvisors.forEach((advisor) => {
      let score = 0;
      let totalPossible = 0;

      // 1️⃣ Interest Match (40%)
      const matchedInterests = student.researchInterests.filter((interest) =>
        advisor.researchFocus.includes(interest)
      );
      const interestScore =
        (matchedInterests.length / student.researchInterests.length) * 40;
      score += interestScore;
      totalPossible += 40;

      // 2️⃣ Academic Field Match (30%)
      if (advisor.specialization === student.academicField) {
        score += 30;
      }
      totalPossible += 30;

      const matchPercentage = (score / totalPossible) * 100;

      // Build human-readable explanation
      let reason = "";
      if (matchedInterests.length > 0 && advisor.specialization === student.academicField) {
        reason = `Shares same field (${student.academicField}) and common interests: ${matchedInterests.join(", ")}.`;
      } else if (matchedInterests.length > 0) {
        reason = `Different field but shares interests in ${matchedInterests.join(", ")}.`;
      } else if (advisor.specialization === student.academicField) {
        reason = `Same academic field (${student.academicField}), but different research focus.`;
      } else {
        reason = `Different field and no shared interests.`;
      }

      advisorMatches.push({
        advisorId: advisor.id,
        advisorName: advisor.name,
        matchPercentage: matchPercentage.toFixed(2),
        matchedInterests,
        reason,
      });
    });

    // Step 3️⃣ – Sort by score
    advisorMatches.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // Step 4️⃣ – Decision Logic
    const bestAdvisor = advisorMatches[0];

    if (bestAdvisor && bestAdvisor.matchPercentage >= 50) {
      // Strong match — assign directly
      const advisorRef = advisors.find((a) => a.id === bestAdvisor.advisorId);
      if (advisorRef) advisorRef.currentLoad += 1;

      matches.push({
        studentId: student.id,
        studentName: student.name,
        assignedAdvisor: bestAdvisor,
        status: "✅ Strong Match",
      });
    } else {
      // Low-confidence — recommend options instead
      matches.push({
        studentId: student.id,
        studentName: student.name,
        assignedAdvisor: null,
        status: "⚠️ No suitable match found",
        recommendations: advisorMatches.map((a) => ({
          advisorName: a.advisorName,
          matchPercentage: a.matchPercentage,
          reason: a.reason,
        })),
      });
    }
  });

  // Step 5️⃣ – Log full advisors for debugging
  const fullAdvisors = advisors.filter(
    (advisor) => advisor.currentLoad >= advisor.maxCapacity
  );
  if (fullAdvisors.length > 0) {
    console.log("\n🚫 Advisors skipped (full capacity reached):");
    fullAdvisors.forEach((advisor) => {
      console.log(
        `- ${advisor.name} (ID: ${advisor.id}) – Capacity ${advisor.currentLoad}/${advisor.maxCapacity}`
      );
    });
  }

  return matches;
}

module.exports = matchStudentsToAdvisors;
