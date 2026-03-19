async function loadDirectory() {
  const res = await fetch("./people.json");
  const people = await res.json();

  const container = document.getElementById("directory");
  const searchBox = document.getElementById("search");
  const functionFilter = document.getElementById("functionFilter");
  const locationFilter = document.getElementById("locationFilter");
  const clearBtn = document.getElementById("clearFilters");

  const totalCount = document.getElementById("totalCount");
  const functionCount = document.getElementById("functionCount");
  const resultsCount = document.getElementById("resultsCount");

  const functionDashboard = document.getElementById("functionDashboard");
  const locationDashboard = document.getElementById("locationDashboard");

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
    const fullName = getValue(person, ["name", "fullName"]);
    if (fullName) return fullName;

    const first = getValue(person, ["First Name", "firstName"]);
    const last = getValue(person, ["Last Name", "lastName"]);
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

  function getRawLocation(person) {
    return getValue(person, ["location", "Location", "Remote/Location"]);
  }

  function getDescription(person) {
    const desc = getValue(person, ["description", "Description", "Short Description"]);
    if (!desc) return "";

    const lower = desc.toLowerCase();
    if (lower.includes("most recently served") && lower.includes("grubhub")) {
      return "";
    }

    return desc;
  }

  function getLinkedIn(person) {
    return getValue(person, ["linkedin", "LinkedIn", "Linkedin", "Linked In"]);
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function shortDescription(text) {
    const clean = normalizeText(text);
    if (!clean) return "";
    return clean.length > 140 ? `${clean.slice(0, 140).trim()}...` : clean;
  }

  function normalizeLocation(value) {
    const v = String(value || "").toLowerCase().trim();

    if (!v) return "Unknown";
    if (v.includes("new york") || v.includes("nyc") || v.includes("ny city")) return "New York";
    if (v.includes("chicago")) return "Chicago";
    if (v.includes("boston")) return "Boston";
    if (v.includes("san francisco") || v.includes("bay area")) return "SF Bay Area";
    if (v.includes("los angeles")) return "Los Angeles";
    if (v.includes("seattle")) return "Seattle";
    if (v.includes("oakland")) return "Oakland";
    if (v.includes("denver") || v.includes("broomfield") || v.includes("colorado")) return "Colorado";
    if (v.includes("austin")) return "Austin";
    if (v.includes("remote") || v.includes("anywhere")) return "Remote";

    return value || "Other";
  }

  function getRegion(value) {
    const v = String(value || "").toLowerCase().trim();

    if (!v) return "Unknown";
    if (v.includes("remote") || v.includes("anywhere")) return "Remote";
    if (v.includes("new york") || v.includes("nyc") || v.includes("ny city") || v.includes("boston") || v.includes("rhode island")) return "East Coast";
    if (v.includes("chicago") || v.includes("ohio")) return "Midwest";
    if (
      v.includes("san francisco") ||
      v.includes("bay area") ||
      v.includes("los angeles") ||
      v.includes("seattle") ||
      v.includes("oakland")
    ) return "West Coast";
    if (v.includes("denver") || v.includes("broomfield") || v.includes("colorado") || v.includes("austin") || v.includes("texas")) return "Central / Mountain";

    return "Other";
  }

  function startsWithVowelSound(word) {
    const clean = String(word || "").trim().toLowerCase();
    return /^[aeiou]/.test(clean);
  }

  function formatRole(person) {
    const role = getRole(person);
    const company = getCompany(person);

    if (!role) return `Most recently served at ${company}.`;

    const roleLower = role.toLowerCase();
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

    return `<span class="linkedin pending">LinkedIn: Coming soon</span>`;
  }

  function uniqueValuesFromPeople(list, getter) {
    return [...new Set(list.map(getter).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function countBy(list, getter) {
    const counts = {};
    list.forEach((person) => {
      const key = getter(person);
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
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

  function populateLocationFilter(baseList) {
    const currentValue = locationFilter.value;
    const counts = countBy(baseList, (person) => normalizeLocation(getRawLocation(person)));
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    locationFilter.innerHTML = `<option value="">All Locations</option>`;

    entries.forEach(([location, count]) => {
      const option = document.createElement("option");
      option.value = location;
      option.textContent = `${location} (${count})`;
      locationFilter.appendChild(option);
    });

    if (currentValue && counts[currentValue]) {
      locationFilter.value = currentValue;
    } else {
      locationFilter.value = "";
    }
  }

  function renderDashboard() {
    const functionCounts = countBy(people, getFunction);
    const regionCounts = countBy(people, (person) => getRegion(getRawLocation(person)));

    const functionEntries = Object.entries(functionCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const regionEntries = Object.entries(regionCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    functionDashboard.innerHTML = "";
    locationDashboard.innerHTML = "";

    functionEntries.forEach(([fn, count]) => {
      const el = document.createElement("div");
      el.className = "function-card";
      el.innerHTML = `
        <div class="function-name">${fn}</div>
        <div class="function-value">${count}</div>
      `;
      el.onclick = () => {
        functionFilter.value = fn;
        locationFilter.value = "";
        applyFilters();
        document.getElementById("directory-section").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      };
      functionDashboard.appendChild(el);
    });

    regionEntries.forEach(([region, count]) => {
      const el = document.createElement("div");
      el.className = "function-card";
      el.innerHTML = `
        <div class="function-name">${region}</div>
        <div class="function-value">${count}</div>
      `;
      locationDashboard.appendChild(el);
    });

    totalCount.textContent = people.length;
    functionCount.textContent = Object.keys(functionCounts).length;
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
      const rawLocation = getRawLocation(person);
      const description = getDescription(person);

      const card = document.createElement("article");
      card.className = "card";

      card.innerHTML = `
        <div class="tag">Open to Work</div>
        <h3>${name}</h3>
        <p class="role">${role}</p>
        ${rawLocation ? `<div class="meta">📍 ${rawLocation}</div>` : ""}
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
    const selectedLocation = locationFilter.value.trim();

    const functionFiltered = people.filter((person) => {
      return !selectedFunction || getFunction(person) === selectedFunction;
    });

    populateLocationFilter(functionFiltered);

    if (selectedLocation) {
      locationFilter.value = selectedLocation;
    }

    const activeLocation = locationFilter.value.trim();

    const filtered = functionFiltered.filter((person) => {
      const personLocation = normalizeLocation(getRawLocation(person));

      const matchesLocation = !activeLocation || personLocation === activeLocation;

      const haystack = [
        getName(person),
        getRole(person),
        getFunction(person),
        getRawLocation(person),
        getDescription(person),
        getCompany(person),
        getLinkedIn(person)
      ].join(" ").toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesLocation && matchesSearch;
    });

    render(filtered);
  }

  clearBtn.onclick = () => {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";
    populateFunctionFilter();
    populateLocationFilter(people);
    render(people);
  };

  searchBox.oninput = applyFilters;

  functionFilter.onchange = () => {
    locationFilter.value = "";
    applyFilters();
  };

  locationFilter.onchange = applyFilters;

  populateFunctionFilter();
  populateLocationFilter(people);
  renderDashboard();
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