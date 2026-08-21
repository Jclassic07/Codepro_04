const API_URL = "https://jsonplaceholder.typicode.com/users";

function initUserDirectory() {
  const userGrid = document.getElementById("userGrid");
  const skeletonGrid = document.getElementById("skeletonGrid");
  const statusPanel = document.getElementById("statusPanel");
  const statusText = document.getElementById("statusText");
  const retryBtn = document.getElementById("retryBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const resultCount = document.getElementById("resultCount");
  const detailBackdrop = document.getElementById("detailBackdrop");
  const detailClose = document.getElementById("detailClose");
  const detailAvatar = document.getElementById("detailAvatar");
  const detailName = document.getElementById("detailName");
  const detailUsername = document.getElementById("detailUsername");
  const detailList = document.getElementById("detailList");
  const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
  const pages = Array.from(document.querySelectorAll(".page"));
  const companyGroups = document.getElementById("companyGroups");
  const locationGroups = document.getElementById("locationGroups");
  const companyCount = document.getElementById("companyCount");
  const largestCompany = document.getElementById("largestCompany");
  const avgPerCompany = document.getElementById("avgPerCompany");
  const cityCount = document.getElementById("cityCount");
  const locatedCount = document.getElementById("locatedCount");
  const aboutLoaded = document.getElementById("aboutLoaded");

  let users = [];
  let searchTerm = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getInitials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter((part) => /[a-zA-Z]/.test(part))
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function showStatus(message, withRetry) {
    statusText.textContent = message;
    retryBtn.hidden = !withRetry;
    statusPanel.hidden = false;
  }

  function hideStatus() {
    statusPanel.hidden = true;
    retryBtn.hidden = true;
  }

  function setLoading(isLoading) {
    skeletonGrid.hidden = !isLoading;
    refreshBtn.disabled = isLoading;
    if (isLoading) {
      userGrid.innerHTML = "";
      resultCount.textContent = "";
      hideStatus();
    }
  }

  function matchesSearch(user, term) {
    if (!term) return true;
    const haystack = [
      user.name,
      user.username,
      user.email,
      user.phone,
      user.company?.name,
      user.address?.city
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  }

  function sortUsers(list) {
    const mode = sortSelect.value;
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sorted = [...list];

    if (mode === "name-desc") return sorted.sort((a, b) => byName(b, a));
    if (mode === "company") {
      return sorted.sort(
        (a, b) =>
          (a.company?.name || "").localeCompare(b.company?.name || "") ||
          byName(a, b)
      );
    }
    if (mode === "city") {
      return sorted.sort(
        (a, b) =>
          (a.address?.city || "").localeCompare(b.address?.city || "") ||
          byName(a, b)
      );
    }
    return sorted.sort(byName);
  }

  function renderUsers() {
    const term = searchTerm.trim().toLowerCase();
    const visible = sortUsers(users.filter((user) => matchesSearch(user, term)));

    resultCount.textContent = `${visible.length} of ${users.length} users`;

    if (users.length === 0) {
      userGrid.innerHTML = "";
      return;
    }

    if (visible.length === 0) {
      userGrid.innerHTML = `
        <p class="empty-state">No users match “${escapeHtml(searchTerm)}”.</p>
      `;
      return;
    }

    userGrid.innerHTML = visible
      .map(
        (user) => `
          <article class="user-card" tabindex="0" role="button" data-id="${escapeHtml(user.id)}">
            <div class="card-head">
              <div class="avatar">${escapeHtml(getInitials(user.name))}</div>
              <div>
                <h3>${escapeHtml(user.name)}</h3>
                <p class="muted">@${escapeHtml(user.username)}</p>
              </div>
            </div>
            <ul class="card-meta">
              <li><span class="icon">✉️</span>${escapeHtml(user.email)}</li>
              <li><span class="icon">📞</span>${escapeHtml(user.phone)}</li>
              <li><span class="icon">📍</span>${escapeHtml(user.address?.city || "Unknown city")}</li>
            </ul>
            <span class="company-badge">${escapeHtml(user.company?.name || "Independent")}</span>
          </article>
        `
      )
      .join("");
  }

  function showPage(name) {
    pages.forEach((page) => page.classList.toggle("active", page.id === name));
    navButtons.forEach((button) =>
      button.classList.toggle("active", button.dataset.page === name)
    );
    if (window.location.hash.slice(1) !== name) {
      window.location.hash = name;
    }
  }

  function groupBy(list, keyFor) {
    const groups = new Map();
    list.forEach((user) => {
      const key = keyFor(user) || "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(user);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function renderGroups(container, groups, emptyLabel) {
    if (groups.length === 0) {
      container.innerHTML = `<p class="empty-state">${escapeHtml(emptyLabel)}</p>`;
      return;
    }

    container.innerHTML = groups
      .map(
        ([key, members]) => `
          <section class="group">
            <header class="group-head">
              <h3>${escapeHtml(key)}</h3>
              <span class="company-badge">${members.length} ${
                members.length === 1 ? "person" : "people"
              }</span>
            </header>
            <ul class="group-members">
              ${members
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(
                  (user) => `
                    <li class="group-member" tabindex="0" role="button"
                      data-id="${escapeHtml(user.id)}">
                      <span class="avatar small">${escapeHtml(
                        getInitials(user.name)
                      )}</span>
                      <span class="member-text">
                        <strong>${escapeHtml(user.name)}</strong>
                        <span class="muted">${escapeHtml(user.email)}</span>
                      </span>
                    </li>
                  `
                )
                .join("")}
            </ul>
          </section>
        `
      )
      .join("");
  }

  function renderCompanies() {
    const groups = groupBy(users, (user) => user.company?.name);
    renderGroups(companyGroups, groups, "No companies to show yet.");

    companyCount.textContent = groups.length;
    const biggest = groups.reduce(
      (best, group) => (group[1].length > (best?.[1].length || 0) ? group : best),
      null
    );
    largestCompany.textContent = biggest ? biggest[0] : "–";
    avgPerCompany.textContent = groups.length
      ? (users.length / groups.length).toFixed(1)
      : "0";
  }

  function renderLocations() {
    const groups = groupBy(users, (user) => user.address?.city);
    renderGroups(locationGroups, groups, "No locations to show yet.");

    cityCount.textContent = groups.length;
    locatedCount.textContent = users.filter((user) => user.address?.city).length;
  }

  function renderAll() {
    renderUsers();
    renderCompanies();
    renderLocations();
    aboutLoaded.textContent = users.length
      ? `${users.length} users loaded at ${new Date().toLocaleTimeString()}`
      : "Not loaded yet";
  }

  function openDetails(user) {
    detailAvatar.textContent = getInitials(user.name);
    detailName.textContent = user.name;
    detailUsername.textContent = `@${user.username}`;

    const address = user.address || {};
    const rows = [
      ["Email", user.email],
      ["Phone", user.phone],
      ["Website", user.website],
      ["Company", user.company?.name],
      ["Catchphrase", user.company?.catchPhrase],
      [
        "Address",
        [address.suite, address.street, address.city, address.zipcode]
          .filter(Boolean)
          .join(", ")
      ]
    ];

    detailList.innerHTML = rows
      .map(
        ([label, value]) => `
          <div class="detail-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || "—")}</dd>
          </div>
        `
      )
      .join("");

    detailBackdrop.hidden = false;
  }

  function closeDetails() {
    detailBackdrop.hidden = true;
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format from the API.");
      }
      users = data;
      setLoading(false);
      if (users.length === 0) {
        showStatus("The API returned no users.", true);
      }
      renderAll();
    } catch (error) {
      users = [];
      setLoading(false);
      renderAll();
      showStatus(`Could not load users: ${error.message}`, true);
    }
  }

  userGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".user-card");
    if (!card) return;
    const user = users.find((item) => String(item.id) === card.dataset.id);
    if (user) openDetails(user);
  });

  userGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".user-card");
    if (!card) return;
    event.preventDefault();
    const user = users.find((item) => String(item.id) === card.dataset.id);
    if (user) openDetails(user);
  });

  [companyGroups, locationGroups].forEach((container) => {
    container.addEventListener("click", (event) => {
      const member = event.target.closest(".group-member");
      if (!member) return;
      const user = users.find((item) => String(item.id) === member.dataset.id);
      if (user) openDetails(user);
    });

    container.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const member = event.target.closest(".group-member");
      if (!member) return;
      event.preventDefault();
      const user = users.find((item) => String(item.id) === member.dataset.id);
      if (user) openDetails(user);
    });
  });

  navButtons.forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  window.addEventListener("hashchange", () => {
    const target = window.location.hash.slice(1);
    if (pages.some((page) => page.id === target)) showPage(target);
  });

  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderUsers();
  });

  sortSelect.addEventListener("change", renderUsers);
  refreshBtn.addEventListener("click", loadUsers);
  retryBtn.addEventListener("click", loadUsers);
  detailClose.addEventListener("click", closeDetails);

  detailBackdrop.addEventListener("click", (event) => {
    if (event.target === detailBackdrop) closeDetails();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetails();
  });

  const initialPage = window.location.hash.slice(1);
  showPage(pages.some((page) => page.id === initialPage) ? initialPage : "directory");

  loadUsers();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUserDirectory);
} else {
  initUserDirectory();
}
