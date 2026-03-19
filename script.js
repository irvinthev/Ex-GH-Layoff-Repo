async function loadDirectory() {
  const res = await fetch("./people.json");
  const people = await res.json();

  const container = document.getElementById("directory");
  const searchBox = document.getElementById("search");
  const functionFilter = document.getElementById("functionFilter");
  const clearBtn = document.getElementById("clearFilters");

  const totalCount = document.getElementById("totalCount");
  const functionCount = document.getElementById("functionCount");
  const resultsCount = document.getElementById("resultsCount");

  const functionDashboard = document.getElementById("functionDashboard");

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
  }

  function uniqueValues(field) {
    return [...new Set(people.map((p) => p[field]).filter(Boolean))].sort();
  }

  function countByField(list, field) {
    const counts = {};
    list.forEach((item) => {
      const value = item[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    return counts;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function shortDescription(text) {
    const clean = normalizeText(text);
    if (!clean) return "";
    return clean.length > 140 ? `${clean.slice(0, 140).trim()}...` : clean;
  }

  function formatRole(person) {
    const role = normalizeText(person.formerRole || person.role);
    const company = normalizeText(person.company || "Grubhub");

    if (!role) return `Most recently served at ${company}.`;

    const roleLower = role.charAt(0).toLowerCase() + role.slice(1);
    return `Most recently served as a ${roleLower} at ${company}.`;
  }

  function renderLinkedIn(person) {
    const link = normalizeText(person.linkedin);
    const isValid = link && /^https?:\/\//i.test(link);

    if (isValid) {
      return `
        <a href="${link}" target="_blank" rel="noopener noreferrer" class="linkedin">
          View LinkedIn →
        </a>
      `;
    }

    return `
      <span class="linkedin pending">
        LinkedIn: Coming soon
      </span>
    `;
  }

  function populateFunctionFilter() {
    const functions = uniqueValues("function");
    functions.forEach((fn) => {
      const option = document.createElement("option");
      option.value = fn;
      option.textContent = fn;
      functionFilter.appendChild(option);
    });
  }

  function renderDashboard(list) {
    const counts = countByField(list, "function");
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? entries[0][1] : 1;

    functionDashboard.innerHTML = "";

    entries.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "dashboard-row";

      const percentage = (value / max) * 100;

      row.innerHTML = `
        <div class="dashboard-label">${label}</div>
        <div class="dashboard-bar-wrap">
          <div class="dashboard-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="dashboard-value">${value}</div>
      `;

      functionDashboard.appendChild(row);
    });
  }

  function renderPeople(list) {
    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          No matches found. Try a different search or clear filters.
        </div>
      `;
      resultsCount.textContent = "0 results";
      return;
    }

    resultsCount.textContent = `${list.length} result${list.length === 1 ? "" : "s"}`;

    list.forEach((person) => {
      const card = document.createElement("article");
      card.className = "card";
      card.setAttribute("data-name", slugify(person.name));

      card.innerHTML = `
        <div class="tag">Open to Work</div>

        <h3>${normalizeText(person.name)}</h3>
        <p class="role">${normalizeText(person.formerRole || person.role || "")}</p>

        <div class="meta">
          ${normalizeText(person.location) ? `📍 ${normalizeText(person.location)}` : ""}
        </div>

        <p class="summary">
          ${formatRole(person)}
        </p>

        ${
          normalizeText(person.description)
            ? `<p class="description">${shortDescription(person.description)}</p>`
            : ""
        }

        <div class="footer">
          ${renderLinkedIn(person)}
        </div>
      `;

      container.appendChild(card);
    });
  }

  function applyFilters() {
    const searchTerm = searchBox.value.trim().toLowerCase();
    const selectedFunction = functionFilter.value;

    const filtered = people.filter((person) => {
      const matchesFunction =
        !selectedFunction || normalizeText(person.function) === selectedFunction;

      const haystack = [
        person.name,
        person.formerRole,
        person.role,
        person.function,
        person.location,
        person.description,
        person.company
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm);

      return matchesFunction && matchesSearch;
    });

    renderPeople(filtered);
  }

  searchBox.addEventListener("input", applyFilters);
  functionFilter.addEventListener("change", applyFilters);

  clearBtn.addEventListener("click", () => {
    searchBox.value = "";
    functionFilter.value = "";
    applyFilters();
  });

  totalCount.textContent = people.length;
  functionCount.textContent = uniqueValues("function").length;

  populateFunctionFilter();
  renderDashboard(people);
  renderPeople(people);
}

loadDirectory().catch((error) => {
  console.error("Failed to load directory:", error);

  const container = document.getElementById("directory");
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        Something broke while loading the directory. Check your people.json file and file paths.
      </div>
    `;
  }
});