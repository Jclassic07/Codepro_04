import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const html = readFileSync(resolve(rootDir, "index.html"), "utf8");

/**
 * Renders index.html into the jsdom document and (re-)executes the app scripts,
 * mirroring how the browser boots the page.
 */
export async function loadApp({ storedCourses } = {}) {
  const bodyHtml = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
  document.body.innerHTML = bodyHtml;

  localStorage.clear();
  if (storedCourses !== undefined) {
    localStorage.setItem(
      "gradeiq-courses",
      typeof storedCourses === "string" ? storedCourses : JSON.stringify(storedCourses)
    );
  }

  vi.resetModules();
  await import("../../grade-logic.js");
  await import("../../script.js");
}

export function readStoredCourses() {
  return JSON.parse(localStorage.getItem("gradeiq-courses"));
}

export function fire(el, type) {
  el.dispatchEvent(new window.Event(type, { bubbles: true }));
}

export function setValue(el, value, type = "input") {
  el.value = value;
  fire(el, type);
}
