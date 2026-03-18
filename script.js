async function loadDirectory() {
  const response = await fetch("./people.json");
  const people = await response.json();

  const container = document.getElementById("directory");
  const searchBox = document.getElementById("search");
  const functionFilter = document.getElementById("functionFilter");
  const locationFilter = document.getElementById("locationFilter");
  const clearFiltersBtn = document.getElementById("clearFilters");

  const totalCount = document.getElementById("totalCount");
  const functionCount = document.getElementById("functionCount");
  const functionDashboard = document.getElementById("functionDashboard");
  const locationDashboard = document.getElementById("locationDashboard");

  function uniqueValues(field) {
    return [...new Set(people.map((p) => p[field]).filter(Boolean))].sort();
  }

  function countByField(field) {
    const counts = {};
    people.forEach((person) => {
      const value = person[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    return counts;
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[\/,]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function normalizeLocation(value) {
    const raw = String(value || "").trim().toLowerCase();

    if (!raw) return "";

    if (raw.includes("new york") || raw.includes("nyc") || raw.includes("ny city")) return "New York";
    if (raw.includes("chicago")) return "Chicago";
    if (raw.includes("boston")) return "Boston";
    if (raw.includes("san francisco") || raw.includes("bay area")) return "San Francisco Bay Area";
    if (raw.includes("los angeles")) return "Los Angeles";
    if (raw.includes("seattle")) return "Seattle";
    if (raw.includes("austin")) return "Austin";
    if (raw.includes("denver")) return "Denver";
    if (raw.includes("oakland")) return "Oakland";
    if (raw.includes("rhode island")) return "Rhode Island";
    if (raw.includes("romania")) return "Romania";
    if (raw.includes("remote")) return "Remote";

    return String(value || "").trim();
  }

  function countByNormalizedLocation() {
    const counts = {};
    people.forEach((person) => {
      const normalized = normalizeLocation(person["Remote/Location"]);
      if (normalized) {
        counts[normalized] = (counts[normalized] || 0) + 1;
      }
    });
    return counts;
  }

  function populateFilters() {
    functionFilter.innerHTML = '<option value="">All Functions</option>';
    locationFilter.innerHTML = '<option value="">All Locations</option>';

    uniqueValues("Function").forEach((f) => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f;
      functionFilter.appendChild(option);
    });

    const normalizedLocations = [
      ...new Set(
        people
          .map((p) => normalizeLocation(p["Remote/Location"]))
          .filter(Boolean)
      )
    ].sort();

    normalizedLocations.forEach((loc) => {
      const option = document.createElement("option");
      option.value = loc;
      option.textContent = loc;
      locationFilter.appendChild(option);
    });
  }

  function renderFunctionDashboard() {
    const functionCounts = countByField("Function");
    const sortedFunctions = Object.entries(functionCounts).sort((a, b) => b[1] - a[1]);

    functionDashboard.innerHTML = "";

    sortedFunctions.forEach(([name, count]) => {
      const card = document.createElement("div");
      card.className = "function-card";
      card.innerHTML = `
        <div class="function-name">${name}</div>
        <div class="function-value">${count}</div>
      `;

      card.addEventListener("click", () => {
        functionFilter.value = name;
        applyFilters();
        document.getElementById("directory-section").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      functionDashboard.appendChild(card);
    });

    totalCount.textContent = people.length;
    functionCount.textContent = uniqueValues("Function").length;
  }

  function renderLocationDashboard() {
    const locationCounts = countByNormalizedLocation();
    const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);

    locationDashboard.innerHTML = "";

    sortedLocations.forEach(([name, count]) => {
      const card = document.createElement("div");
      card.className = "function-card";
      card.innerHTML = `
        <div class="function-name">${name}</div>
        <div class="function-value">${count}</div>
      `;

      card.addEventListener("click", () => {
        locationFilter.value = name;
        applyFilters();
        document.getElementById("directory-section").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      locationDashboard.appendChild(card);
    });
  }

  function render(list) {
    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = "<p>No matching results found.</p>";
      return;
    }

    list.forEach((person) => {
      const name = [
        person["First Name"] || "",
        person["Last Name"] || person["Name"] || ""
      ]
        .join(" ")
        .trim();

      const formerRole = person["Former Job Title"] || "";
      const team = person["Team"] || "";
      const jobFunction = person["Function"] || "";
      const location = person["Remote/Location"] || "";
      const linkedin = person["LinkedIn URL"] || "";
      const description = person["Description"] || "";

      const cleanLocation = location.replace(/\s*\/\s*/g, " / ").trim();
      const functionClass = `badge-${slugify(jobFunction)}`;

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        ${jobFunction ? `<div class="badge ${functionClass}">${jobFunction}</div>` : ""}
        <h3>${name || "Unnamed Person"}</h3>
        <p><strong>Former Role:</strong> ${formerRole}</p>
        ${team ? `<p><strong>Team:</strong> ${team}</p>` : ""}
        ${cleanLocation ? `<p class="location-badge">📍 ${cleanLocation}</p>` : ""}
        ${description ? `<p>${description}</p>` : ""}
        ${
          linkedin
            ? `<a class="linkedin-btn" href="${linkedin}" target="_blank" rel="noopener noreferrer">View LinkedIn</a>`
            : ""
        }
      `;

      container.appendChild(card);
    });
  }

  function applyFilters() {
    const query = searchBox.value.toLowerCase().trim();
    const selectedFunction = functionFilter.value;
    const selectedLocation = locationFilter.value;

    const filtered = people.filter((person) => {
      const matchesSearch = Object.values(person).some((val) =>
        String(val).toLowerCase().includes(query)
      );

      const matchesFunction =
        !selectedFunction || person["Function"] === selectedFunction;

      const normalizedPersonLocation = normalizeLocation(person["Remote/Location"]);
      const matchesLocation =
        !selectedLocation || normalizedPersonLocation === selectedLocation;

      return matchesSearch && matchesFunction && matchesLocation;
    });

    render(filtered);
  }

  clearFiltersBtn.addEventListener("click", () => {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";
    applyFilters();
  });

  populateFilters();
  renderFunctionDashboard();
  renderLocationDashboard();
  render(people);

  searchBox.addEventListener("input", applyFilters);
  functionFilter.addEventListener("change", applyFilters);
  locationFilter.addEventListener("change", applyFilters);
}

loadDirectory();