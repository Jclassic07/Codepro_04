function initGradeIQ() {
  // Initial default course list
  const defaultCourses = [
    { id: "1", name: "Mathematics I", category: "Core", term: "Fall 2026", score: 88, credits: 3 },
    { id: "2", name: "Computer Science", category: "Major", term: "Fall 2026", score: 94, credits: 4 },
    { id: "3", name: "Physics Lab", category: "Lab", term: "Spring 2026", score: 72, credits: 2 }
  ];
  const categoryOptions = ["Core", "Major", "Lab", "Elective"];
  const termOptions = ["Fall 2025", "Spring 2026", "Summer 2026", "Fall 2026", "Winter 2026"];
  const maxCourseNameLength = 200;

  let courses = getStoredCourses() || defaultCourses;

  // DOM Elements
  const navBtns = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");
  const courseRows = document.getElementById("courseRows");
  const addCourseBtn = document.getElementById("addCourseBtn");
  const termFilter = document.getElementById("termFilter");
  const clearDataBtn = document.getElementById("clearDataBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  const settingsForm = document.getElementById("settingsForm");

  // Multi-Page Navigation
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetPage = btn.dataset.page;
      navBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      pages.forEach((page) => page.classList.remove("active"));
      const pageSection = document.getElementById(targetPage);
      if (pageSection) pageSection.classList.add("active");
    });
  });

  // Theme switcher handling
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      document.body.setAttribute("data-theme", e.target.value);
    });
  }

  function updateResponsiveState() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle("mobile-view", isMobile);
  }

  updateResponsiveState();
  window.addEventListener("resize", updateResponsiveState);

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function normalizeCourses(value) {
    if (!Array.isArray(value)) return null;

    const usedIds = new Set();
    let generatedId = 0;
    return value.reduce((normalized, entry) => {
      if (!isPlainObject(entry)) return normalized;

      let id = entry.id === undefined || entry.id === null ? "" : String(entry.id).trim();
      if (!id || usedIds.has(id)) {
        do {
          generatedId += 1;
          id = `course-${Date.now()}-${generatedId}`;
        } while (usedIds.has(id));
      }

      const name = entry.name === undefined || entry.name === null
        ? ""
        : String(entry.name).trim().slice(0, maxCourseNameLength);
      if (!name) return normalized;

      usedIds.add(id);
      normalized.push({
        id,
        name,
        category: categoryOptions.includes(entry.category) ? entry.category : "Core",
        term: termOptions.includes(entry.term) ? entry.term : "Fall 2026",
        score: clampNumber(entry.score, 0, 100, 0),
        credits: clampNumber(entry.credits, 0, 30, 0)
      });
      return normalized;
    }, []);
  }

  function getStoredCourses() {
    try {
      const stored = localStorage.getItem("gradeiq-courses");
      return stored ? normalizeCourses(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  }

  function saveState() {
    localStorage.setItem("gradeiq-courses", JSON.stringify(courses));
    updateAnalytics();
    syncPlannerInputs();
  }

  function getGradeInfo(score) {
    if (score >= 90) return { grade: "A", gpa: 4.0 };
    if (score >= 80) return { grade: "B", gpa: 3.0 };
    if (score >= 70) return { grade: "C", gpa: 2.0 };
    if (score >= 60) return { grade: "D", gpa: 1.0 };
    return { grade: "F", gpa: 0.0 };
  }

  function updateTermFilterOptions() {
    if (!termFilter) return;
    const selected = termFilter.value || "All";
    const terms = [...new Set(courses.map((c) => c.term))].sort();
    const hasSelectedTerm = selected === "All" || terms.includes(selected);
    termFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "All";
    allOption.textContent = "All Terms";
    allOption.selected = !hasSelectedTerm || selected === "All";
    termFilter.appendChild(allOption);

    terms.forEach((term) => {
      const option = document.createElement("option");
      option.value = term;
      option.textContent = term;
      option.selected = term === selected;
      termFilter.appendChild(option);
    });
  }

  function renderTable() {
    if (!courseRows) return;

    const selectedTerm = termFilter?.value || "All";
    const filteredCourses =
      selectedTerm === "All"
        ? courses
        : courses.filter((course) => course.term === selectedTerm);

    courseRows.replaceChildren();

    if (filteredCourses.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.textContent = "No courses found. Add a course to get started.";
      row.appendChild(cell);
      courseRows.appendChild(row);
    } else {
      filteredCourses.forEach((course) => {
        const info = getGradeInfo(course.score);
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        const nameInput = document.createElement("input");
        nameInput.className = "course-name";
        nameInput.setAttribute("data-id", course.id);
        nameInput.maxLength = maxCourseNameLength;
        nameInput.value = course.name;
        nameCell.appendChild(nameInput);
        row.appendChild(nameCell);

        const categoryCell = document.createElement("td");
        const categorySelect = document.createElement("select");
        categorySelect.className = "course-category";
        categorySelect.setAttribute("data-id", course.id);
        categoryOptions.forEach((category) => {
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category;
          option.selected = category === course.category;
          categorySelect.appendChild(option);
        });
        categoryCell.appendChild(categorySelect);
        row.appendChild(categoryCell);

        const termCell = document.createElement("td");
        const termSelect = document.createElement("select");
        termSelect.className = "course-term";
        termSelect.setAttribute("data-id", course.id);
        termOptions.forEach((term) => {
          const option = document.createElement("option");
          option.value = term;
          option.textContent = term;
          option.selected = term === course.term;
          termSelect.appendChild(option);
        });
        termCell.appendChild(termSelect);
        row.appendChild(termCell);

        const scoreCell = document.createElement("td");
        const scoreInput = document.createElement("input");
        scoreInput.type = "number";
        scoreInput.min = "0";
        scoreInput.max = "100";
        scoreInput.className = "course-score";
        scoreInput.setAttribute("data-id", course.id);
        scoreInput.value = course.score;
        scoreCell.appendChild(scoreInput);
        row.appendChild(scoreCell);

        const creditsCell = document.createElement("td");
        const creditsInput = document.createElement("input");
        creditsInput.type = "number";
        creditsInput.min = "0";
        creditsInput.max = "30";
        creditsInput.step = "0.5";
        creditsInput.className = "course-credits";
        creditsInput.setAttribute("data-id", course.id);
        creditsInput.value = course.credits;
        creditsCell.appendChild(creditsInput);
        row.appendChild(creditsCell);

        const gradeCell = document.createElement("td");
        const gradeBadge = document.createElement("span");
        gradeBadge.className = `grade-badge ${info.grade}`;
        gradeBadge.textContent = info.grade;
        gradeCell.appendChild(gradeBadge);
        row.appendChild(gradeCell);

        const pointsCell = document.createElement("td");
        const points = document.createElement("span");
        points.className = "points-val";
        points.textContent = info.gpa.toFixed(1);
        pointsCell.appendChild(points);
        row.appendChild(pointsCell);

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.setAttribute("data-id", course.id);
        deleteButton.textContent = "Delete";
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        courseRows.appendChild(row);
      });
    }

    updateTermFilterOptions();
    attachTableEvents();
    updateAnalytics();
    syncPlannerInputs();
  }

  function attachTableEvents() {
    document.querySelectorAll(".course-name").forEach((input) => {
      input.addEventListener("input", (e) => {
        const item = courses.find((c) => c.id === e.target.dataset.id);
        if (item) { item.name = e.target.value; saveState(); }
      });
    });

    document.querySelectorAll(".course-category").forEach((select) => {
      select.addEventListener("change", (e) => {
        const item = courses.find((c) => c.id === e.target.dataset.id);
        if (item) { item.category = e.target.value; saveState(); }
      });
    });

    document.querySelectorAll(".course-term").forEach((select) => {
      select.addEventListener("change", (e) => {
        const item = courses.find((c) => c.id === e.target.dataset.id);
        if (item) { item.term = e.target.value; saveState(); }
      });
    });

    document.querySelectorAll(".course-score").forEach((input) => {
      input.addEventListener("input", (e) => {
        const item = courses.find((c) => c.id === e.target.dataset.id);
        if (item) {
          item.score = clampNumber(e.target.value, 0, 100, 0);
          e.target.value = item.score;
          const tr = e.target.closest("tr");
          const info = getGradeInfo(item.score);
          const badge = tr.querySelector(".grade-badge");
          const points = tr.querySelector(".points-val");
          if (badge) {
            badge.textContent = info.grade;
            badge.className = `grade-badge ${info.grade}`;
          }
          if (points) points.textContent = info.gpa.toFixed(1);
          saveState();
        }
      });
    });

    document.querySelectorAll(".course-credits").forEach((input) => {
      input.addEventListener("input", (e) => {
        const item = courses.find((c) => c.id === e.target.dataset.id);
        if (item) {
          item.credits = clampNumber(e.target.value, 0, 30, 0);
          e.target.value = item.credits;
          saveState();
        }
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        courses = courses.filter((c) => c.id !== e.target.dataset.id);
        saveState();
        renderTable();
      });
    });
  }

  function updateAnalytics() {
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

    const avgScore = totalCredits > 0 ? totalWeightedScore / totalCredits : 0;
    const cumulativeGPA = totalCredits > 0 ? totalWeightedGPA / totalCredits : 0;

    // Summary Strip
    document.getElementById("stripGPA").textContent = cumulativeGPA.toFixed(2);
    document.getElementById("stripAvg").textContent = `${avgScore.toFixed(1)}%`;
    document.getElementById("stripCredits").textContent = totalCredits;

    const standingEl = document.getElementById("stripStanding");
    if (cumulativeGPA >= 3.5) {
      standingEl.textContent = "Honors";
      standingEl.style.color = "var(--success)";
    } else if (cumulativeGPA >= 2.0) {
      standingEl.textContent = "Good Standing";
      standingEl.style.color = "var(--accent)";
    } else {
      standingEl.textContent = "At Risk";
      standingEl.style.color = "var(--danger)";
    }

    // Analytics Tab
    document.getElementById("anaGPA").textContent = cumulativeGPA.toFixed(2);
    document.getElementById("anaAvg").textContent = `${avgScore.toFixed(1)}%`;
    document.getElementById("anaCredits").textContent = totalCredits;

    const distContainer = document.getElementById("gradeDistribution");
    if (distContainer) {
      distContainer.replaceChildren();
      Object.keys(counts).forEach((grade) => {
        const count = counts[grade];
        const rawPct = courses.length > 0 ? (count / courses.length) * 100 : 0;
        const pct = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 0;
        const item = document.createElement("div");
        item.className = "dist-bar-item";
        const label = document.createElement("strong");
        label.textContent = grade;
        item.appendChild(label);
        const barBackground = document.createElement("div");
        barBackground.className = "dist-bar-bg";
        const barFill = document.createElement("div");
        barFill.className = "dist-bar-fill";
        barFill.style.width = `${pct}%`;
        barBackground.appendChild(barFill);
        item.appendChild(barBackground);
        const countLabel = document.createElement("span");
        countLabel.textContent = count;
        item.appendChild(countLabel);
        distContainer.appendChild(item);
      });
    }

    const insightEl = document.getElementById("smartInsightText");
    if (insightEl) {
      if (courses.length === 0) {
        insightEl.textContent = "No coursework entered yet. Add courses to generate personalized feedback.";
      } else if (cumulativeGPA >= 3.5) {
        insightEl.textContent = "🌟 Excellent academic performance! Maintain this consistency to graduate with Honors.";
      } else if (cumulativeGPA >= 2.5) {
        insightEl.textContent = "👍 Solid performance. Focus additional study effort on classes with lower percentage scores to raise your GPA.";
      } else {
        insightEl.textContent = "⚠️ Academic warning: Your cumulative GPA is low. Consider tutoring or academic counseling.";
      }
    }
  }

  function syncPlannerInputs() {
    let totalWeightedGPA = 0;
    let totalCredits = 0;

    courses.forEach((c) => {
      const info = getGradeInfo(c.score);
      totalWeightedGPA += info.gpa * c.credits;
      totalCredits += c.credits;
    });

    const currentGPA = totalCredits > 0 ? totalWeightedGPA / totalCredits : 0;
    document.getElementById("planCurrentGPA").value = currentGPA.toFixed(2);
    document.getElementById("planCurrentCredits").value = totalCredits;
  }

  const calcTargetBtn = document.getElementById("calculateTargetBtn");
  if (calcTargetBtn) {
    calcTargetBtn.addEventListener("click", () => {
      const curGPA = parseFloat(document.getElementById("planCurrentGPA").value) || 0;
      const curCredits = parseFloat(document.getElementById("planCurrentCredits").value) || 0;
      const targetGPA = parseFloat(document.getElementById("planTargetGPA").value) || 0;
      const remCredits = parseFloat(document.getElementById("planRemainingCredits").value) || 0;
      const outputEl = document.getElementById("targetOutput");

      if (remCredits <= 0) {
        outputEl.innerHTML = `<p style="color:var(--danger)">Remaining credits must be greater than 0.</p>`;
        return;
      }

      const targetPoints = targetGPA * (curCredits + remCredits);
      const currentPoints = curGPA * curCredits;
      const neededPoints = targetPoints - currentPoints;
      const neededGPA = neededPoints / remCredits;

      if (neededGPA > 4.0) {
        outputEl.innerHTML = `
          <h4 style="color:var(--danger)">Goal Unattainable</h4>
          <div class="target-highlight">${neededGPA.toFixed(2)}</div>
          <p>Required GPA exceeds maximum possible GPA (4.0). Try increasing future credit hours.</p>
        `;
      } else if (neededGPA < 0) {
        outputEl.innerHTML = `
          <h4 style="color:var(--success)">Goal Achieved!</h4>
          <div class="target-highlight">0.00</div>
          <p>Your current GPA is high enough that you will meet your goal even with standard passing marks.</p>
        `;
      } else {
        outputEl.innerHTML = `
          <h4>Required Average GPA</h4>
          <div class="target-highlight">${neededGPA.toFixed(2)}</div>
          <p>Maintain an average of <strong>${neededGPA.toFixed(2)} GPA points</strong> across your next <strong>${remCredits} credit hours</strong>.</p>
        `;
      }
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => e.preventDefault());
  }

  if (addCourseBtn) {
    addCourseBtn.addEventListener("click", () => {
      courses.push({
        id: Date.now().toString(),
        name: "New Course",
        category: "Core",
        term: "Fall 2026",
        score: 85,
        credits: 3
      });
      saveState();
      renderTable();
    });
  }

  if (termFilter) termFilter.addEventListener("change", renderTable);

  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all data?")) {
        courses = [];
        saveState();
        renderTable();
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(courses, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gradeiq-data.json";
      a.click();
    });
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          const normalized = normalizeCourses(imported);
          if (!normalized) {
            alert("Invalid JSON file format.");
            return;
          }
          courses = normalized;
          saveState();
          renderTable();
          alert("Course data imported successfully!");
        } catch (err) {
          alert("Invalid JSON file format.");
        }
      };
      reader.readAsText(file);
    });
  }

  // Initial Boot
  renderTable();
  updateAnalytics();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGradeIQ);
} else {
  initGradeIQ();
}
