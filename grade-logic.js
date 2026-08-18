/**
 * Pure grading/analytics logic for GradeIQ Pro.
 * Loaded as a plain browser script (exposes window.GradeLogic) and importable
 * in Node test environments via module.exports.
 */
(function (root, factory) {
  const api = factory();
  root.GradeLogic = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GRADE_SCALE = [
    { min: 90, grade: "A", gpa: 4.0 },
    { min: 80, grade: "B", gpa: 3.0 },
    { min: 70, grade: "C", gpa: 2.0 },
    { min: 60, grade: "D", gpa: 1.0 },
    { min: -Infinity, grade: "F", gpa: 0.0 }
  ];

  function getGradeInfo(score) {
    const numeric = Number(score);
    const value = Number.isFinite(numeric) ? numeric : 0;
    const entry = GRADE_SCALE.find((s) => value >= s.min);
    return { grade: entry.grade, gpa: entry.gpa };
  }

  function parseStoredCourses(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function uniqueSortedTerms(courses) {
    return [...new Set(courses.map((c) => c.term))].sort();
  }

  function filterByTerm(courses, term) {
    if (!term || term === "All") return courses;
    return courses.filter((course) => course.term === term);
  }

  function computeAnalytics(courses) {
    let totalWeightedScore = 0;
    let totalWeightedGPA = 0;
    let totalCredits = 0;
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    courses.forEach((c) => {
      const info = getGradeInfo(c.score);
      totalWeightedScore += c.score * c.credits;
      totalWeightedGPA += info.gpa * c.credits;
      totalCredits += c.credits;
      counts[info.grade]++;
    });

    return {
      totalCredits,
      counts,
      avgScore: totalCredits > 0 ? totalWeightedScore / totalCredits : 0,
      cumulativeGPA: totalCredits > 0 ? totalWeightedGPA / totalCredits : 0
    };
  }

  function getStanding(cumulativeGPA) {
    if (cumulativeGPA >= 3.5) return { label: "Honors", color: "var(--success)" };
    if (cumulativeGPA >= 2.0) return { label: "Good Standing", color: "var(--accent)" };
    return { label: "At Risk", color: "var(--danger)" };
  }

  function getInsight(courseCount, cumulativeGPA) {
    if (courseCount === 0) {
      return "No coursework entered yet. Add courses to generate personalized feedback.";
    }
    if (cumulativeGPA >= 3.5) {
      return "🌟 Excellent academic performance! Maintain this consistency to graduate with Honors.";
    }
    if (cumulativeGPA >= 2.5) {
      return "👍 Solid performance. Focus additional study effort on classes with lower percentage scores to raise your GPA.";
    }
    return "⚠️ Academic warning: Your cumulative GPA is low. Consider tutoring or academic counseling.";
  }

  function gradeDistribution(counts, courseCount) {
    return Object.keys(counts).map((grade) => ({
      grade,
      count: counts[grade],
      pct: courseCount > 0 ? (counts[grade] / courseCount) * 100 : 0
    }));
  }

  /**
   * Average GPA required across remaining credits to hit a target cumulative GPA.
   * Returns { status: "invalid" | "unattainable" | "achieved" | "ok", neededGPA }.
   */
  function computeRequiredGPA({ currentGPA, currentCredits, targetGPA, remainingCredits }) {
    if (!(remainingCredits > 0)) return { status: "invalid", neededGPA: null };

    const targetPoints = targetGPA * (currentCredits + remainingCredits);
    const currentPoints = currentGPA * currentCredits;
    const neededGPA = (targetPoints - currentPoints) / remainingCredits;

    if (neededGPA > 4.0) return { status: "unattainable", neededGPA };
    if (neededGPA < 0) return { status: "achieved", neededGPA };
    return { status: "ok", neededGPA };
  }

  return {
    GRADE_SCALE,
    getGradeInfo,
    parseStoredCourses,
    uniqueSortedTerms,
    filterByTerm,
    computeAnalytics,
    getStanding,
    getInsight,
    gradeDistribution,
    computeRequiredGPA
  };
});
