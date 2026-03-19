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

  function getValue(person, keys) {
    for (const key of keys) {
      const value = person[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  }

  function getName(person) {
    const fullName = getValue(person, ["name", "Name"]);
    if (fullName) return fullName;

    const first = getValue(person, ["First Name", "firstName"]);
    const last = getValue(person, ["Last Name", "lastName", "Name"]);
    return `${first} ${last}`.trim();
  }

  function getFunction(person) {
    return getValue(person, ["function", "Function"]);
  }

  function getRole(person) {
    return getValue(person, ["formerRole", "Former Role", "Former Job Title", "role"]);
  }

  function getCompany(person) {
    return getValue(person, ["company", "Company"]) || "Grubhub";
  }

  function getLocation(person) {
    return getValue(person, ["location", "Location", "Remote/Location"]);
  }

  function getDescription(person) {
    return getValue(person, ["description", "Description", "Short Description"]);
  }

  function getLinkedIn(person) {
    return getValue(person, ["linkedin", "LinkedIn", "Linkedin", "Linked In"]);
  }

  function uniqueValuesFromPeople(list, getter) {
    return [...new Set(list.map(getter).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function countByFunction(list) {
    const counts = {};
    list.forEach((person) => {
      const fn = getFunction(person);
      if (fn) counts[fn] = (counts[fn] || 0) + 1;
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

  function startsWithVowelSound(word) {
    const clean = String(word || "").trim().toLowerCase();
    if (!clean) return false;
    return /^[aeiou]/.test(clean);
  }

  function formatRole(person) {
    const role = getRole(person);
    const company = getCompany(person);

    if (!role) {
      return `Most recently served at ${company}.`;
    }

    const roleLower = role.charAt(0).toLowerCase() + role.slice(1);
    const article = startsWithVowelSound(roleLower) ? "an" : "a";

    return `Most recently served as ${article} ${roleLower} at ${company}.`;
  }

  function renderLinkedIn(person) {
    const link = getLinkedIn(person);
    const isValid = /^https?:\/\//i.test(link);

    if (isValid) {
      return `
        <a href="${link}" target="_blank" rel="noopener noreferrer" class="linkedin">
          View LinkedIn →
        </a>
      `;
    }

    return `
      <span class="linkedin pending">LinkedIn: Coming soon</span>
    `;
  }

  function populateFunctionFilter() {
    const currentValue = functionFilter.value;
    const functions = uniqueValuesFromPeople(people, getFunction);

    functionFilter.innerHTML = `<option value="">All Functions</option>`;

    functions.forEach((fn) => {
      const option = document.createElement("option");
      option.value = fn;
      option.textContent = fn;
      functionFilter.appendChild(option);
    });

    functionFilter.value = currentValue;
  }

  function renderDashboard(list) {
    const counts = countByFunction(list);
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    functionDashboard.innerHTML = "";

    entries.forEach(([fn, count]) => {
      const el = document.createElement("div");
      el.className = "function-card";
      el.innerHTML = `
        <div class="function-name">${fn}</div>
        <div class="function-value">${count}</div>
      `;

      el.onclick = () => {
        functionFilter.value = fn;
        applyFilters();
        document.getElementById("directory-section").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      };

      functionDashboard.appendChild(el);
    });

    totalCount.textContent = people.length;
    functionCount.textContent = Object.keys(counts).length;
  }

  function render(list) {
    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          No matches found. Try a different search or clear filters.
        </div>
      `;
      if (resultsCount) resultsCount.textContent = "0 results";
      return;
    }

    if (resultsCount) {
      resultsCount.textContent = `${list.length} result${list.length === 1 ? "" : "s"}`;
    }

    list.forEach((person) => {
      const name = getName(person);
      const role = getRole(person);
      const location = getLocation(person);
      const description = getDescription(person);

      const card = document.createElement("article");
      card.className = "card";

      card.innerHTML = `
        <div class="tag">Open to Work</div>

        <h3>${name}</h3>
        <p class="role">${role}</p>

        ${location ? `<div class="meta">📍 ${location}</div>` : ""}

        <p class="summary">${formatRole(person)}</p>

        ${description ? `<p class="description">${shortDescription(description)}</p>` : ""}

        <div class="footer">
          ${renderLinkedIn(person)}
        </div>
      `;

      container.appendChild(card);
    });
  }

  function applyFilters() {
    const q = searchBox.value.toLowerCase().trim();
    const selectedFunction = functionFilter.value.trim();

    const filtered = people.filter((person) => {
      const matchesFunction =
        !selectedFunction || getFunction(person) === selectedFunction;

      const haystack = [
        getName(person),
        getRole(person),
        getFunction(person),
        getLocation(person),
        getDescription(person),
        getCompany(person),
        getLinkedIn(person)
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesFunction && matchesSearch;
    });

    render(filtered);
  }

  clearBtn.onclick = () => {
    searchBox.value = "";
    functionFilter.value = "";
    render(people);
  };

  searchBox.oninput = applyFilters;
  functionFilter.onchange = applyFilters;

  populateFunctionFilter();
  renderDashboard(people);
  render(people);
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