import { describe, expect, it } from "vitest";
import GradeLogic from "../grade-logic.js";

const {
  getGradeInfo,
  parseStoredCourses,
  uniqueSortedTerms,
  filterByTerm,
  computeAnalytics,
  getStanding,
  getInsight,
  gradeDistribution,
  computeRequiredGPA
} = GradeLogic;

const course = (overrides = {}) => ({
  id: "1",
  name: "Course",
  category: "Core",
  term: "Fall 2026",
  score: 85,
  credits: 3,
  ...overrides
});

describe("getGradeInfo", () => {
  it.each([
    [100, "A", 4.0],
    [90, "A", 4.0],
    [89.9, "B", 3.0],
    [80, "B", 3.0],
    [79, "C", 2.0],
    [70, "C", 2.0],
    [69, "D", 1.0],
    [60, "D", 1.0],
    [59.9, "F", 0.0],
    [0, "F", 0.0],
    [-10, "F", 0.0]
  ])("maps score %s to %s / %s GPA", (score, grade, gpa) => {
    expect(getGradeInfo(score)).toEqual({ grade, gpa });
  });

  it("treats non-numeric scores as 0", () => {
    expect(getGradeInfo("not a number")).toEqual({ grade: "F", gpa: 0.0 });
    expect(getGradeInfo(undefined)).toEqual({ grade: "F", gpa: 0.0 });
  });

  it("coerces numeric strings", () => {
    expect(getGradeInfo("95")).toEqual({ grade: "A", gpa: 4.0 });
  });
});

describe("parseStoredCourses", () => {
  it("parses valid JSON", () => {
    expect(parseStoredCourses('[{"id":"1"}]')).toEqual([{ id: "1" }]);
  });

  it("returns null for empty or missing input", () => {
    expect(parseStoredCourses(null)).toBeNull();
    expect(parseStoredCourses("")).toBeNull();
    expect(parseStoredCourses(undefined)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseStoredCourses("{not json")).toBeNull();
  });
});

describe("uniqueSortedTerms", () => {
  it("de-duplicates and sorts terms", () => {
    const terms = uniqueSortedTerms([
      course({ term: "Spring 2026" }),
      course({ term: "Fall 2026" }),
      course({ term: "Spring 2026" })
    ]);
    expect(terms).toEqual(["Fall 2026", "Spring 2026"]);
  });

  it("returns an empty list for no courses", () => {
    expect(uniqueSortedTerms([])).toEqual([]);
  });
});

describe("filterByTerm", () => {
  const courses = [course({ id: "a", term: "Fall 2026" }), course({ id: "b", term: "Spring 2026" })];

  it("returns every course for 'All' or a missing term", () => {
    expect(filterByTerm(courses, "All")).toEqual(courses);
    expect(filterByTerm(courses, "")).toEqual(courses);
    expect(filterByTerm(courses, undefined)).toEqual(courses);
  });

  it("keeps only matching courses", () => {
    expect(filterByTerm(courses, "Spring 2026").map((c) => c.id)).toEqual(["b"]);
  });

  it("returns an empty list for an unknown term", () => {
    expect(filterByTerm(courses, "Winter 2026")).toEqual([]);
  });
});

describe("computeAnalytics", () => {
  it("returns zeroed stats for no courses", () => {
    expect(computeAnalytics([])).toEqual({
      totalCredits: 0,
      counts: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      avgScore: 0,
      cumulativeGPA: 0
    });
  });

  it("weights scores and GPA by credits", () => {
    const stats = computeAnalytics([
      course({ id: "1", score: 90, credits: 4 }),
      course({ id: "2", score: 70, credits: 1 })
    ]);
    expect(stats.totalCredits).toBe(5);
    expect(stats.avgScore).toBeCloseTo(86, 5);
    expect(stats.cumulativeGPA).toBeCloseTo(3.6, 5);
    expect(stats.counts).toEqual({ A: 1, B: 0, C: 1, D: 0, F: 0 });
  });

  it("counts grades of zero-credit courses without affecting averages", () => {
    const stats = computeAnalytics([course({ score: 95, credits: 0 })]);
    expect(stats.totalCredits).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.cumulativeGPA).toBe(0);
    expect(stats.counts.A).toBe(1);
  });
});

describe("getStanding", () => {
  it.each([
    [4.0, "Honors"],
    [3.5, "Honors"],
    [3.49, "Good Standing"],
    [2.0, "Good Standing"],
    [1.99, "At Risk"],
    [0, "At Risk"]
  ])("labels GPA %s as %s", (gpa, label) => {
    expect(getStanding(gpa).label).toBe(label);
  });

  it("provides a CSS colour variable per standing", () => {
    expect(getStanding(3.9).color).toBe("var(--success)");
    expect(getStanding(3.0).color).toBe("var(--accent)");
    expect(getStanding(1.0).color).toBe("var(--danger)");
  });
});

describe("getInsight", () => {
  it("asks for coursework when there are no courses", () => {
    expect(getInsight(0, 0)).toMatch(/No coursework entered yet/);
  });

  it("returns tiered feedback based on GPA", () => {
    expect(getInsight(3, 3.5)).toMatch(/Excellent academic performance/);
    expect(getInsight(3, 2.5)).toMatch(/Solid performance/);
    expect(getInsight(3, 2.49)).toMatch(/Academic warning/);
  });
});

describe("gradeDistribution", () => {
  it("computes percentages per grade", () => {
    const dist = gradeDistribution({ A: 1, B: 1, C: 0, D: 0, F: 2 }, 4);
    expect(dist.map((d) => d.grade)).toEqual(["A", "B", "C", "D", "F"]);
    expect(dist.find((d) => d.grade === "A")).toEqual({ grade: "A", count: 1, pct: 25 });
    expect(dist.find((d) => d.grade === "F").pct).toBe(50);
  });

  it("uses 0% when there are no courses", () => {
    const dist = gradeDistribution({ A: 0, B: 0, C: 0, D: 0, F: 0 }, 0);
    expect(dist.every((d) => d.pct === 0 && d.count === 0)).toBe(true);
  });
});

describe("computeRequiredGPA", () => {
  it("rejects non-positive remaining credits", () => {
    for (const remainingCredits of [0, -5]) {
      expect(
        computeRequiredGPA({ currentGPA: 3, currentCredits: 10, targetGPA: 3.5, remainingCredits })
      ).toEqual({ status: "invalid", neededGPA: null });
    }
  });

  it("computes the required average for a reachable goal", () => {
    const result = computeRequiredGPA({
      currentGPA: 3.0,
      currentCredits: 30,
      targetGPA: 3.2,
      remainingCredits: 15
    });
    expect(result.status).toBe("ok");
    expect(result.neededGPA).toBeCloseTo(3.6, 5);
  });

  it("flags goals requiring more than a 4.0 average", () => {
    const result = computeRequiredGPA({
      currentGPA: 2.0,
      currentCredits: 60,
      targetGPA: 3.9,
      remainingCredits: 6
    });
    expect(result.status).toBe("unattainable");
    expect(result.neededGPA).toBeGreaterThan(4.0);
  });

  it("flags goals already met", () => {
    const result = computeRequiredGPA({
      currentGPA: 4.0,
      currentCredits: 60,
      targetGPA: 3.0,
      remainingCredits: 15
    });
    expect(result.status).toBe("achieved");
    expect(result.neededGPA).toBeLessThan(0);
  });

  it("treats an exactly-4.0 requirement as attainable", () => {
    const result = computeRequiredGPA({
      currentGPA: 0,
      currentCredits: 0,
      targetGPA: 4.0,
      remainingCredits: 12
    });
    expect(result).toEqual({ status: "ok", neededGPA: 4.0 });
  });
});
