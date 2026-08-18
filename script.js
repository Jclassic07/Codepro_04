const {
  categoryOptions,
  termOptions,
  getGradeInfo,
  setText,
  getNumberValue,
  renderSelectOptions,
  computeCourseTotals,
  getStoredCourses,
  saveStoredCourses
} = window.GradeIQUtils;

function initGradeIQ() {
  // Initial default course list
  const defaultCourses = [
    { id: "1", name: "Mathematics I", category: "Core", term: "Fall 2026", score: 88, credits: 3 },
    { id: "2", name: "Computer Science", category: "Major", term: "Fall 2026", score: 94, credits: 4 },
    { id: "3", name: "Physics Lab", category: "Lab", term: "Spring 2026", score: 72, credits: 2 }
  ];

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

  function saveState() {
    saveStoredCourses(courses);
    updateAnalytics();
    syncPlannerInputs();
  }

  function updateTermFilterOptions() {
    if (!termFilter) return;
    const selected = termFilter.value || "All";
    const terms = [...new Set(courses.map((c) => c.term))].sort();
    termFilter.innerHTML = `
      <option value="All">All Terms</option>
      ${terms
        .map(
          (term) =>
            `<option value="${term}" ${
              term === selected ? "selected" : ""
            }>${term}</option>`
        )
        .join("")}
    `;
  }

  function renderTable() {
    if (!courseRows) return;

    const selectedTerm = termFilter?.value || "All";
    const filteredCourses =
      selectedTerm === "All"
        ? courses
        : courses.filter((course) => course.term === selectedTerm);

    if (filteredCourses.length === 0) {
      courseRows.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">No courses found. Add a course to get started.</td>
        </tr>
      `;
    } else {
      courseRows.innerHTML = filteredCourses
        .map((course) => {
          const info = getGradeInfo(course.score);
          return `
            <tr>
              <td><input class="course-name" data-id="${course.id}" value="${course.name}" /></td>
              <td>
                <select class="course-category" data-id="${course.id}">
                  ${renderSelectOptions(categoryOptions, course.category)}
                </select>
              </td>
              <td>
                <select class="course-term" data-id="${course.id}">
                  ${renderSelectOptions(termOptions, course.term)}
                </select>
              </td>
              <td><input type="number" min="0" max="100" class="course-score" data-id="${course.id}" value="${course.score}" /></td>
              <td><input type="number" min="0" step="0.5" class="course-credits" data-id="${course.id}" value="${course.credits}" /></td>
              <td><span class="grade-badge ${info.grade}">${info.grade}</span></td>
              <td><span class="points-val">${info.gpa.toFixed(1)}</span></td>
              <td><button type="button" class="delete-btn" data-id="${course.id}">Delete</button></td>
            </tr>
          `;
        })
        .join("");
    }

    updateTermFilterOptions();
    attachTableEvents();
    updateAnalytics();
    syncPlannerInputs();
  }

  function attachTableEvents() {
    const inputConfigs = [
      {
        selector: ".course-name",
        event: "input",
        apply: (item, target) => {
          item.name = target.value;
        }
      },
      {
        selector: ".course-category",
        event: "change",
        apply: (item, target) => {
          item.category = target.value;
        }
      },
      {
        selector: ".course-term",
        event: "change",
        apply: (item, target) => {
          item.term = target.value;
        }
      },
      {
        selector: ".course-score",
        event: "input",
        apply: (item, target) => {
          item.score = parseFloat(target.value) || 0;
          const tr = target.closest("tr");
          const info = getGradeInfo(item.score);
          const badge = tr.querySelector(".grade-badge");
          const points = tr.querySelector(".points-val");
          if (badge) {
            badge.textContent = info.grade;
            badge.className = `grade-badge ${info.grade}`;
          }
          if (points) points.textContent = info.gpa.toFixed(1);
        }
      },
      {
        selector: ".course-credits",
        event: "input",
        apply: (item, target) => {
          item.credits = parseFloat(target.value) || 0;
        }
      }
    ];

    inputConfigs.forEach((config) => {
      document.querySelectorAll(config.selector).forEach((input) => {
        input.addEventListener(config.event, (e) => {
          const target = e.target;
          const item = courses.find((c) => c.id === target.dataset.id);
          if (item) {
            config.apply(item, target);
            saveState();
          }
        });
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
    const { totalCredits, avgScore, cumulativeGPA, counts } =
      computeCourseTotals(courses);

    // Summary Strip
    [
      ["stripGPA", cumulativeGPA.toFixed(2)],
      ["stripAvg", `${avgScore.toFixed(1)}%`],
      ["stripCredits", totalCredits]
    ].forEach(([id, value]) => setText(id, value));

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
    [
      ["anaGPA", cumulativeGPA.toFixed(2)],
      ["anaAvg", `${avgScore.toFixed(1)}%`],
      ["anaCredits", totalCredits]
    ].forEach(([id, value]) => setText(id, value));

    const distContainer = document.getElementById("gradeDistribution");
    if (distContainer) {
      distContainer.innerHTML = "";
      Object.keys(counts).forEach((grade) => {
        const count = counts[grade];
        const pct = courses.length > 0 ? (count / courses.length) * 100 : 0;
        distContainer.innerHTML += `
          <div class="dist-bar-item">
            <strong>${grade}</strong>
            <div class="dist-bar-bg">
              <div class="dist-bar-fill" style="width: ${pct}%"></div>
            </div>
            <span>${count}</span>
          </div>
        `;
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
    const { totalCredits, cumulativeGPA } = computeCourseTotals(courses);
    document.getElementById("planCurrentGPA").value = cumulativeGPA.toFixed(2);
    document.getElementById("planCurrentCredits").value = totalCredits;
  }

  const calcTargetBtn = document.getElementById("calculateTargetBtn");
  if (calcTargetBtn) {
    calcTargetBtn.addEventListener("click", () => {
      const curGPA = getNumberValue("planCurrentGPA");
      const curCredits = getNumberValue("planCurrentCredits");
      const targetGPA = getNumberValue("planTargetGPA");
      const remCredits = getNumberValue("planRemainingCredits");
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
          if (Array.isArray(imported)) {
            courses = imported;
            saveState();
            renderTable();
            alert("Course data imported successfully!");
          }
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
