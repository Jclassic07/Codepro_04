import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fire, loadApp, readStoredCourses, setValue } from "./helpers/loadApp.js";

const DEFAULT_COURSES = [
  { id: "1", name: "Mathematics I", category: "Core", term: "Fall 2026", score: 88, credits: 3 },
  { id: "2", name: "Computer Science", category: "Major", term: "Fall 2026", score: 94, credits: 4 },
  { id: "3", name: "Physics Lab", category: "Lab", term: "Spring 2026", score: 72, credits: 2 }
];

const rows = () => [...document.querySelectorAll("#courseRows tr")];
const names = () => [...document.querySelectorAll(".course-name")].map((i) => i.value);
const text = (id) => document.getElementById(id).textContent;

beforeEach(() => {
  vi.restoreAllMocks();
  window.URL.createObjectURL = vi.fn(() => "blob:mock");
});

afterEach(() => {
  localStorage.clear();
});

describe("initial render", () => {
  it("renders the default courses with grades and points", async () => {
    await loadApp();

    expect(names()).toEqual(["Mathematics I", "Computer Science", "Physics Lab"]);
    const badges = [...document.querySelectorAll(".grade-badge")].map((b) => b.textContent);
    expect(badges.slice(0, 3)).toEqual(["B", "A", "C"]);
    expect([...document.querySelectorAll(".points-val")].map((p) => p.textContent)).toEqual([
      "3.0",
      "4.0",
      "2.0"
    ]);
  });

  it("populates the summary strip and analytics from the courses", async () => {
    await loadApp();

    // credits 3+4+2 = 9, weighted GPA (3*3 + 4*4 + 2*2)/9 = 3.22
    expect(text("stripGPA")).toBe("3.22");
    expect(text("stripCredits")).toBe("9");
    expect(text("stripAvg")).toBe("87.1%");
    expect(text("stripStanding")).toBe("Good Standing");
    expect(text("anaGPA")).toBe("3.22");
    expect(text("anaCredits")).toBe("9");
    expect(text("smartInsightText")).toMatch(/Solid performance/);
  });

  it("mirrors current GPA and credits into the planner inputs", async () => {
    await loadApp();

    expect(document.getElementById("planCurrentGPA").value).toBe("3.22");
    expect(document.getElementById("planCurrentCredits").value).toBe("9");
  });

  it("renders one distribution bar per letter grade", async () => {
    await loadApp();

    const items = [...document.querySelectorAll("#gradeDistribution .dist-bar-item")];
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.querySelector("strong").textContent)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "F"
    ]);
    expect(items.map((i) => i.querySelector("span").textContent)).toEqual([
      "1",
      "1",
      "1",
      "0",
      "0"
    ]);
  });

  it("builds term filter options from the stored courses", async () => {
    await loadApp();

    expect([...document.getElementById("termFilter").options].map((o) => o.value)).toEqual([
      "All",
      "Fall 2026",
      "Spring 2026"
    ]);
  });
});

describe("boot", () => {
  it("defers initialisation until DOMContentLoaded while the document is loading", async () => {
    vi.spyOn(window.Document.prototype, "readyState", "get").mockReturnValue("loading");

    await loadApp();
    expect(rows()).toHaveLength(0);

    vi.restoreAllMocks();
    document.dispatchEvent(new window.Event("DOMContentLoaded"));

    expect(names()).toEqual(DEFAULT_COURSES.map((c) => c.name));
  });
});

describe("persisted state", () => {
  it("restores courses from localStorage", async () => {
    await loadApp({
      storedCourses: [
        { id: "9", name: "Stored Course", category: "Core", term: "Winter 2026", score: 55, credits: 2 }
      ]
    });

    expect(names()).toEqual(["Stored Course"]);
    expect(text("stripGPA")).toBe("0.00");
    expect(text("stripStanding")).toBe("At Risk");
    expect(text("smartInsightText")).toMatch(/Academic warning/);
  });

  it("falls back to the defaults when stored data is corrupt", async () => {
    await loadApp({ storedCourses: "{ not json" });

    expect(names()).toEqual(DEFAULT_COURSES.map((c) => c.name));
  });

  it("falls back to the defaults when localStorage is unreadable", async () => {
    vi.spyOn(window.Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    await loadApp();

    expect(names()).toEqual(DEFAULT_COURSES.map((c) => c.name));
  });

  it("preselects the stored category and term of each course", async () => {
    await loadApp({
      storedCourses: [
        { id: "1", name: "A", category: "Elective", term: "Fall 2025", score: 80, credits: 3 },
        { id: "2", name: "B", category: "Major", term: "Summer 2026", score: 80, credits: 3 },
        { id: "3", name: "C", category: "Lab", term: "Winter 2026", score: 80, credits: 3 }
      ]
    });

    expect([...document.querySelectorAll(".course-category")].map((s) => s.value)).toEqual([
      "Elective",
      "Major",
      "Lab"
    ]);
    expect([...document.querySelectorAll(".course-term")].map((s) => s.value)).toEqual([
      "Fall 2025",
      "Summer 2026",
      "Winter 2026"
    ]);
  });

  it("shows the empty state when no courses remain", async () => {
    await loadApp({ storedCourses: [] });

    expect(rows()).toHaveLength(1);
    expect(rows()[0].classList.contains("empty-row")).toBe(true);
    expect(text("stripGPA")).toBe("0.00");
    expect(text("smartInsightText")).toMatch(/No coursework entered yet/);
  });
});

describe("editing courses", () => {
  it("persists a renamed course", async () => {
    await loadApp();

    setValue(document.querySelectorAll(".course-name")[0], "Calculus II");

    expect(readStoredCourses()[0].name).toBe("Calculus II");
  });

  it("updates grade badge, points and analytics when a score changes", async () => {
    await loadApp();

    setValue(document.querySelectorAll(".course-score")[0], "95");

    const row = document.querySelectorAll("#courseRows tr")[0];
    expect(row.querySelector(".grade-badge").textContent).toBe("A");
    expect(row.querySelector(".grade-badge").className).toBe("grade-badge A");
    expect(row.querySelector(".points-val").textContent).toBe("4.0");
    expect(readStoredCourses()[0].score).toBe(95);
    expect(text("stripGPA")).toBe("3.56");
    expect(text("stripStanding")).toBe("Honors");
  });

  it("treats a blank score as zero", async () => {
    await loadApp();

    setValue(document.querySelectorAll(".course-score")[0], "");

    expect(readStoredCourses()[0].score).toBe(0);
    expect(document.querySelectorAll("#courseRows tr")[0].querySelector(".grade-badge").textContent).toBe(
      "F"
    );
  });

  it("persists credit changes and recomputes totals", async () => {
    await loadApp();

    setValue(document.querySelectorAll(".course-credits")[0], "6");

    expect(readStoredCourses()[0].credits).toBe(6);
    expect(text("stripCredits")).toBe("12");
  });

  it("treats a blank credit value as zero", async () => {
    await loadApp();

    setValue(document.querySelectorAll(".course-credits")[0], "");

    expect(readStoredCourses()[0].credits).toBe(0);
    expect(text("stripCredits")).toBe("6");
  });

  it("persists category and term changes", async () => {
    await loadApp();

    setValue(document.querySelectorAll(".course-category")[0], "Elective", "change");
    setValue(document.querySelectorAll(".course-term")[0], "Winter 2026", "change");

    expect(readStoredCourses()[0].category).toBe("Elective");
    expect(readStoredCourses()[0].term).toBe("Winter 2026");
  });
});

describe("adding and deleting courses", () => {
  it("appends a default course and persists it", async () => {
    await loadApp();

    document.getElementById("addCourseBtn").click();

    expect(names()).toHaveLength(4);
    const stored = readStoredCourses();
    expect(stored).toHaveLength(4);
    expect(stored[3]).toMatchObject({
      name: "New Course",
      category: "Core",
      term: "Fall 2026",
      score: 85,
      credits: 3
    });
  });

  it("removes the selected course only", async () => {
    await loadApp();

    document.querySelectorAll(".delete-btn")[1].click();

    expect(names()).toEqual(["Mathematics I", "Physics Lab"]);
    expect(readStoredCourses().map((c) => c.id)).toEqual(["1", "3"]);
  });
});

describe("term filtering", () => {
  it("shows only courses in the selected term", async () => {
    await loadApp();

    setValue(document.getElementById("termFilter"), "Spring 2026", "change");

    expect(names()).toEqual(["Physics Lab"]);
    // Analytics stay cumulative across all terms
    expect(text("stripCredits")).toBe("9");
  });

  it("shows the empty state when a term has no courses", async () => {
    await loadApp({
      storedCourses: [{ id: "1", name: "Only", category: "Core", term: "Fall 2026", score: 90, credits: 3 }]
    });

    const filter = document.getElementById("termFilter");
    filter.innerHTML = '<option value="Spring 2026">Spring 2026</option>';
    setValue(filter, "Spring 2026", "change");

    expect(rows()[0].classList.contains("empty-row")).toBe(true);
  });
});

describe("clear all data", () => {
  it("wipes courses when confirmed", async () => {
    await loadApp();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    document.getElementById("clearDataBtn").click();

    expect(readStoredCourses()).toEqual([]);
    expect(rows()[0].classList.contains("empty-row")).toBe(true);
  });

  it("keeps courses when cancelled", async () => {
    await loadApp();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    document.getElementById("clearDataBtn").click();

    expect(names()).toHaveLength(3);
  });
});

describe("export and import", () => {
  it("exports the current courses as a JSON download", async () => {
    await loadApp();
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    document.getElementById("exportBtn").click();

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = window.URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("delegates the import button to the hidden file input", async () => {
    await loadApp();
    const fileInput = document.getElementById("importFile");
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    document.getElementById("importBtn").click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("replaces courses with a valid imported file", async () => {
    await loadApp();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const imported = [
      { id: "77", name: "Imported", category: "Major", term: "Fall 2025", score: 91, credits: 5 }
    ];

    importFile(JSON.stringify(imported));

    expect(names()).toEqual(["Imported"]);
    expect(readStoredCourses()).toEqual(imported);
    expect(alertSpy).toHaveBeenCalledWith("Course data imported successfully!");
  });

  it("warns and keeps existing courses for malformed JSON", async () => {
    await loadApp();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    importFile("not json");

    expect(alertSpy).toHaveBeenCalledWith("Invalid JSON file format.");
    expect(names()).toHaveLength(3);
  });

  it("ignores non-array JSON payloads", async () => {
    await loadApp();
    vi.spyOn(window, "alert").mockImplementation(() => {});

    importFile('{"id":"1"}');

    expect(names()).toHaveLength(3);
  });

  it("does nothing when the file dialog is dismissed", async () => {
    await loadApp();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    fire(document.getElementById("importFile"), "change");

    expect(alertSpy).not.toHaveBeenCalled();
    expect(names()).toHaveLength(3);
  });
});

describe("target GPA planner", () => {
  const calculate = ({ target, remaining }) => {
    document.getElementById("planTargetGPA").value = target;
    document.getElementById("planRemainingCredits").value = remaining;
    document.getElementById("calculateTargetBtn").click();
    return document.getElementById("targetOutput");
  };

  it("rejects zero remaining credits", async () => {
    await loadApp();

    expect(calculate({ target: "3.5", remaining: "0" }).textContent).toMatch(
      /Remaining credits must be greater than 0/
    );
  });

  it("reports the required average for a reachable goal", async () => {
    await loadApp();

    const out = calculate({ target: "3.5", remaining: "15" });
    expect(out.querySelector("h4").textContent).toBe("Required Average GPA");
    expect(out.querySelector(".target-highlight").textContent).toBe("3.67");
  });

  it("reports an unattainable goal", async () => {
    await loadApp();

    const out = calculate({ target: "4.0", remaining: "1" });
    expect(out.querySelector("h4").textContent).toBe("Goal Unattainable");
  });

  it("reports an already achieved goal", async () => {
    await loadApp({
      storedCourses: [{ id: "1", name: "Ace", category: "Core", term: "Fall 2026", score: 100, credits: 40 }]
    });

    const out = calculate({ target: "2.0", remaining: "10" });
    expect(out.querySelector("h4").textContent).toBe("Goal Achieved!");
    expect(out.querySelector(".target-highlight").textContent).toBe("0.00");
  });
});

describe("navigation, theme and responsive state", () => {
  it("activates the clicked page and deactivates the others", async () => {
    await loadApp();

    document.querySelector('.nav-btn[data-page="analytics"]').click();

    expect(document.getElementById("analytics").classList.contains("active")).toBe(true);
    expect(document.getElementById("calculator").classList.contains("active")).toBe(false);
    expect(
      [...document.querySelectorAll(".nav-btn.active")].map((b) => b.dataset.page)
    ).toEqual(["analytics"]);
  });

  it("applies the selected theme to the body", async () => {
    await loadApp();

    setValue(document.getElementById("themeSelect"), "light", "change");

    expect(document.body.getAttribute("data-theme")).toBe("light");
  });

  it("toggles the mobile-view class with the viewport width", async () => {
    await loadApp();
    expect(document.body.classList.contains("mobile-view")).toBe(false);

    window.innerWidth = 500;
    fire(window, "resize");
    expect(document.body.classList.contains("mobile-view")).toBe(true);

    window.innerWidth = 1200;
    fire(window, "resize");
    expect(document.body.classList.contains("mobile-view")).toBe(false);
  });
});

/**
 * Fires a change event on the hidden file input with a stubbed file payload,
 * resolving the FileReader synchronously so assertions need no polling.
 */
function importFile(contents) {
  const input = document.getElementById("importFile");
  const file = new window.File([contents], "data.json", { type: "application/json" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });

  const readSpy = vi
    .spyOn(window.FileReader.prototype, "readAsText")
    .mockImplementation(function readAsText() {
      this.onload({ target: { result: contents } });
    });

  try {
    fire(input, "change");
  } finally {
    readSpy.mockRestore();
  }
}
