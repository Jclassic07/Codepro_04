function showNotice(message, level = "error") {
  let host = document.getElementById("noticeHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "noticeHost";
    host.className = "notice-host";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }

  const notice = document.createElement("div");
  notice.className = `notice notice-${level}`;
  notice.textContent = message;
  host.appendChild(notice);

  window.setTimeout(() => notice.remove(), 6000);
}

function reportError(message, error) {
  console.error(`[GradeIQ] ${message}`, error);
  showNotice(message, "error");
}

function requireElement(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`[GradeIQ] Missing required element #${id}`);
  return el;
}

function setText(id, value) {
  const el = requireElement(id);
  if (el) el.textContent = value;
}

// Drops entries that cannot be interpreted as a course and reports how many
// were rejected, instead of letting malformed data reach the calculations.
function sanitizeCourses(input, onReject) {
  if (!Array.isArray(input)) throw new TypeError("Course data must be an array.");

  let rejected = 0;
  const sanitized = [];

  input.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      rejected++;
      return;
    }

    const score = Number(entry.score);
    const credits = Number(entry.credits);
    if (!Number.isFinite(score) || !Number.isFinite(credits)) {
      rejected++;
      return;
    }

    sanitized.push({
      id: entry.id != null ? String(entry.id) : `${Date.now()}-${index}`,
      name: entry.name != null ? String(entry.name) : "Untitled Course",
      category: entry.category != null ? String(entry.category) : "Core",
      term: entry.term != null ? String(entry.term) : "Fall 2026",
      score: Math.min(Math.max(score, 0), 100),
      credits: Math.max(credits, 0)
    });
  });

  if (rejected > 0 && onReject) onReject(rejected);
  return sanitized;
}

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

  function getStoredCourses() {
    let stored;
    try {
      stored = localStorage.getItem("gradeiq-courses");
    } catch (error) {
      reportError("Saved courses could not be read (storage is unavailable). Starting from defaults.", error);
      return null;
    }

    if (!stored) return null;

    try {
      return sanitizeCourses(JSON.parse(stored), (rejected) =>
        showNotice(`${rejected} saved course(s) were malformed and have been skipped.`, "warning")
      );
    } catch (error) {
      reportError("Saved course data is corrupted and was ignored. Starting from defaults.", error);
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem("gradeiq-courses", JSON.stringify(courses));
    } catch (error) {
      reportError("Changes could not be saved to this browser. They will be lost when you reload.", error);
    }

    // Analytics must refresh even when persistence fails, so the UI never
    // shows stale numbers for the data currently in memory.
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
                  <option${course.category === "Core" ? " selected" : ""}>Core</option>
                  <option${course.category === "Major" ? " selected" : ""}>Major</option>
                  <option${course.category === "Lab" ? " selected" : ""}>Lab</option>
                  <option${course.category === "Elective" ? " selected" : ""}>Elective</option>
                </select>
              </td>
              <td>
                <select class="course-term" data-id="${course.id}">
                  <option${course.term === "Fall 2025" ? " selected" : ""}>Fall 2025</option>
                  <option${course.term === "Spring 2026" ? " selected" : ""}>Spring 2026</option>
                  <option${course.term === "Summer 2026" ? " selected" : ""}>Summer 2026</option>
                  <option${course.term === "Fall 2026" ? " selected" : ""}>Fall 2026</option>
                  <option${course.term === "Winter 2026" ? " selected" : ""}>Winter 2026</option>
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
          item.score = parseFloat(e.target.value) || 0;
          const tr = e.target.closest("tr");
          const info = getGradeInfo(item.score);
          const badge = tr?.querySelector(".grade-badge");
          const points = tr?.querySelector(".points-val");
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
          item.credits = parseFloat(e.target.value) || 0;
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
    setText("stripGPA", cumulativeGPA.toFixed(2));
    setText("stripAvg", `${avgScore.toFixed(1)}%`);
    setText("stripCredits", totalCredits);

    const standingEl = requireElement("stripStanding");
    if (standingEl) {
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
    }

    // Analytics Tab
    setText("anaGPA", cumulativeGPA.toFixed(2));
    setText("anaAvg", `${avgScore.toFixed(1)}%`);
    setText("anaCredits", totalCredits);

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
    let totalWeightedGPA = 0;
    let totalCredits = 0;

    courses.forEach((c) => {
      const info = getGradeInfo(c.score);
      totalWeightedGPA += info.gpa * c.credits;
      totalCredits += c.credits;
    });

    const currentGPA = totalCredits > 0 ? totalWeightedGPA / totalCredits : 0;
    const gpaInput = requireElement("planCurrentGPA");
    const creditsInput = requireElement("planCurrentCredits");
    if (gpaInput) gpaInput.value = currentGPA.toFixed(2);
    if (creditsInput) creditsInput.value = totalCredits;
  }

  const calcTargetBtn = document.getElementById("calculateTargetBtn");
  if (calcTargetBtn) {
    calcTargetBtn.addEventListener("click", () => {
      const inputs = [
        "planCurrentGPA",
        "planCurrentCredits",
        "planTargetGPA",
        "planRemainingCredits",
        "targetOutput"
      ].map(requireElement);

      if (inputs.some((el) => !el)) {
        showNotice("The planner form is incomplete, so the goal could not be calculated.", "error");
        return;
      }

      const [curGPAEl, curCreditsEl, targetGPAEl, remCreditsEl, outputEl] = inputs;
      const curGPA = parseFloat(curGPAEl.value) || 0;
      const curCredits = parseFloat(curCreditsEl.value) || 0;
      const targetGPA = parseFloat(targetGPAEl.value) || 0;
      const remCredits = parseFloat(remCreditsEl.value) || 0;

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
      let url;
      try {
        const blob = new Blob([JSON.stringify(courses, null, 2)], { type: "application/json" });
        url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "gradeiq-data.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (error) {
        reportError("Export failed: the course data could not be downloaded.", error);
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    });
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (evt) => {
        let imported;
        try {
          imported = sanitizeCourses(JSON.parse(evt.target.result), (rejected) =>
            showNotice(`${rejected} imported course(s) were malformed and have been skipped.`, "warning")
          );
        } catch (error) {
          reportError(
            `Import failed: ${file.name} is not a valid list of courses.`,
            error
          );
          return;
        }

        courses = imported;
        saveState();
        renderTable();
        showNotice(`Imported ${imported.length} course(s) successfully.`, "success");
      };

      reader.onerror = () => reportError(`Import failed: ${file.name} could not be read.`, reader.error);
      reader.onabort = () => showNotice(`Import of ${file.name} was cancelled.`, "warning");

      // Allow re-importing the same file after a failure.
      importFile.value = "";

      try {
        reader.readAsText(file);
      } catch (error) {
        reportError(`Import failed: ${file.name} could not be opened.`, error);
      }
    });
  }

  // Initial Boot
  renderTable();
  updateAnalytics();
}

function bootGradeIQ() {
  try {
    initGradeIQ();
  } catch (error) {
    reportError("GradeIQ failed to start. Reload the page to try again.", error);
  }
}

window.addEventListener("error", (event) =>
  console.error("[GradeIQ] Uncaught error", event.error || event.message)
);
window.addEventListener("unhandledrejection", (event) =>
  console.error("[GradeIQ] Unhandled promise rejection", event.reason)
);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGradeIQ);
} else {
  bootGradeIQ();
}
