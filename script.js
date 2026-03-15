async function loadDirectory() {
  const response = await fetch("./people.json");
  const people = await response.json();

  const container = document.getElementById("directory");
  const searchBox = document.getElementById("search");
  const functionFilter = document.getElementById("functionFilter");
  const locationFilter = document.getElementById("locationFilter");

  const totalCount = document.getElementById("totalCount");
  const functionCount = document.getElementById("functionCount");
  const locationCount = document.getElementById("locationCount");
  const functionDashboard = document.getElementById("functionDashboard");

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
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[\/,]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
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

    uniqueValues("Remote/Location").forEach((l) => {
      const option = document.createElement("option");
      option.value = l;
      option.textContent = l;
      locationFilter.appendChild(option);
    });
  }

  function renderDashboard() {
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
    locationCount.textContent = uniqueValues("Remote/Location").length;
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

      const functionClass = `badge-${slugify(jobFunction)}`;

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        ${jobFunction ? `<div class="badge ${functionClass}">${jobFunction}</div>` : ""}
        <h3>${name || "Unnamed Person"}</h3>
        <div class="card-meta">${location || "Location not listed"}</div>
        <p><strong>Former Role:</strong> ${formerRole}</p>
        ${team ? `<p><strong>Team:</strong> ${team}</p>` : ""}
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

      const matchesLocation =
        !selectedLocation || person["Remote/Location"] === selectedLocation;

      return matchesSearch && matchesFunction && matchesLocation;
    });

    render(filtered);
  }

  populateFilters();
  renderDashboard();
  render(people);

  searchBox.addEventListener("input", applyFilters);
  functionFilter.addEventListener("change", applyFilters);
  locationFilter.addEventListener("change", applyFilters);
}

loadDirectory();
