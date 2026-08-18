(function (global) {
  const gradeScale = [
    { min: 90, grade: "A", gpa: 4.0 },
    { min: 80, grade: "B", gpa: 3.0 },
    { min: 70, grade: "C", gpa: 2.0 },
    { min: 60, grade: "D", gpa: 1.0 },
    { min: 0, grade: "F", gpa: 0.0 }
  ];

  const categoryOptions = ["Core", "Major", "Lab", "Elective"];
  const termOptions = [
    "Fall 2025",
    "Spring 2026",
    "Summer 2026",
    "Fall 2026",
    "Winter 2026"
  ];

  function getGradeInfo(score) {
    const info =
      gradeScale.find((entry) => score >= entry.min) ||
      gradeScale[gradeScale.length - 1];
    return { grade: info.grade, gpa: info.gpa };
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function getNumberValue(id, fallback = 0) {
    const element = document.getElementById(id);
    return element ? parseFloat(element.value) || fallback : fallback;
  }

  function renderSelectOptions(values, selected) {
    return values
      .map(
        (value) =>
          `<option${value === selected ? " selected" : ""}>${value}</option>`
      )
      .join("");
  }

  function computeCourseTotals(courses) {
    let totalWeightedScore = 0;
    let totalWeightedGPA = 0;
    let totalCredits = 0;
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    courses.forEach((course) => {
      const info = getGradeInfo(course.score);
      totalWeightedScore += course.score * course.credits;
      totalWeightedGPA += info.gpa * course.credits;
      totalCredits += course.credits;
      counts[info.grade]++;
    });

    return {
      totalCredits,
      avgScore: totalCredits > 0 ? totalWeightedScore / totalCredits : 0,
      cumulativeGPA: totalCredits > 0 ? totalWeightedGPA / totalCredits : 0,
      counts
    };
  }

  function getStoredCourses() {
    try {
      const stored = localStorage.getItem("gradeiq-courses");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function saveStoredCourses(courses) {
    localStorage.setItem("gradeiq-courses", JSON.stringify(courses));
  }

  global.GradeIQUtils = {
    gradeScale,
    categoryOptions,
    termOptions,
    getGradeInfo,
    setText,
    getNumberValue,
    renderSelectOptions,
    computeCourseTotals,
    getStoredCourses,
    saveStoredCourses
  };
})(window);
