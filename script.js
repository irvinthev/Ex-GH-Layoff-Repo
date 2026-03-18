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

  const functionDashboard = document.getElementById("functionDashboard");
  const locationDashboard = document.getElementById("locationDashboard");

  function slugify(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[\/,]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function normalizeLocation(v) {
    v = String(v || "").toLowerCase();

    if (v.includes("new york") || v.includes("nyc") || v.includes("ny city")) return "New York";
    if (v.includes("chicago")) return "Chicago";
    if (v.includes("boston")) return "Boston";
    if (v.includes("san francisco") || v.includes("bay area")) return "SF Bay Area";
    if (v.includes("los angeles")) return "Los Angeles";
    if (v.includes("seattle")) return "Seattle";
    if (v.includes("remote") || v.includes("anywhere")) return "Remote";
    if (!v.trim()) return "Unknown";

    return "Other";
  }

  function getRegion(v) {
    v = String(v || "").toLowerCase();

    if (!v.trim()) return "Unknown";

    if (v.includes("new york") || v.includes("nyc") || v.includes("ny city") || v.includes("boston")) return "East Coast";
    if (v.includes("chicago")) return "Midwest";
    if (
      v.includes("san francisco") ||
      v.includes("bay area") ||
      v.includes("los angeles") ||
      v.includes("seattle") ||
      v.includes("oakland")
    ) return "West Coast";
    if (v.includes("remote") || v.includes("anywhere")) return "Remote";

    return "Other";
  }

  function getUniqueFunctions() {
    return [...new Set(people.map((p) => String(p["Function"] || "").trim()).filter(Boolean))].sort();
  }

  function populateFilters(base = people) {
    const selectedFunction = String(functionFilter.value || "").trim();
    const selectedLocation = String(locationFilter.value || "").trim();

    functionFilter.innerHTML = `<option value="">All Functions</option>`;

    getUniqueFunctions().forEach((f) => {
      const cleanFunction = String(f || "").trim();
      const opt = document.createElement("option");
      opt.value = cleanFunction;
      opt.textContent = cleanFunction;
      functionFilter.appendChild(opt);
    });

    // Force selected function back after rebuilding options
    functionFilter.value = selectedFunction;

    const counts = {};

    base.forEach((p) => {
      const loc = normalizeLocation(p["Remote/Location"]);
      if (!loc) return;
      counts[loc] = (counts[loc] || 0) + 1;
    });

    locationFilter.innerHTML = `<option value="">All Locations</option>`;

    Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([loc, count]) => {
        const opt = document.createElement("option");
        opt.value = loc;
        opt.textContent = `${loc} (${count})`;
        locationFilter.appendChild(opt);
      });

    // Restore location only if still valid
    if (selectedLocation && counts[selectedLocation]) {
      locationFilter.value = selectedLocation;
    } else {
      locationFilter.value = "";
    }
  }

  function renderDashboard() {
    const fnCounts = {};
    const regionCounts = {};

    people.forEach((p) => {
      const fn = String(p["Function"] || "").trim();
      const region = getRegion(p["Remote/Location"]);

      if (fn) {
        fnCounts[fn] = (fnCounts[fn] || 0) + 1;
      }
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    functionDashboard.innerHTML = "";
    locationDashboard.innerHTML = "";

    Object.entries(fnCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([k, v]) => {
        const el = document.createElement("div");
        el.className = "function-card";
        el.innerHTML = `
          <div class="function-name">${k}</div>
          <div class="function-value">${v}</div>
        `;
        el.onclick = () => {
          functionFilter.value = String(k).trim();
          locationFilter.value = "";
          applyFilters();
          document.getElementById("directory-section").scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        };
        functionDashboard.appendChild(el);
      });

    Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([k, v]) => {
        const el = document.createElement("div");
        el.className = "function-card";
        el.innerHTML = `
          <div class="function-name">${k}</div>
          <div class="function-value">${v}</div>
        `;
        locationDashboard.appendChild(el);
      });

    totalCount.textContent = people.length;
    functionCount.textContent = Object.keys(fnCounts).length;
  }

  function render(list) {
    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = "<p>No results</p>";
      return;
    }

    list.forEach((p) => {
      const name = `${p["First Name"] || ""} ${p["Name"] || ""}`.trim();
      const fn = String(p["Function"] || "").trim();
      const loc = p["Remote/Location"] || "";

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        ${fn ? `<div class="badge badge-${slugify(fn)}">${fn}</div>` : ""}
        <h3>${name}</h3>
        <p>${p["Former Job Title"] || ""}</p>
        <p class="location-badge">📍 ${loc}</p>
      `;

      container.appendChild(card);
    });
  }

  function applyFilters() {
    const q = searchBox.value.toLowerCase().trim();
    const selectedFunction = String(functionFilter.value || "").trim();
    const selectedLocation = String(locationFilter.value || "").trim();

    const fnFiltered = people.filter((p) => {
      const personFunction = String(p["Function"] || "").trim();
      return !selectedFunction || personFunction === selectedFunction;
    });

    populateFilters(fnFiltered);

    // Force function value again after populate, for iOS Safari
    functionFilter.value = selectedFunction;

    // Restore location only if still valid
    if (selectedLocation) {
      locationFilter.value = selectedLocation;
    }

    const activeLoc = String(locationFilter.value || "").trim();

    const filtered = fnFiltered.filter((p) => {
      const matchesSearch = Object.values(p).some((v) =>
        String(v).toLowerCase().includes(q)
      );

      const matchesLoc =
        !activeLoc || normalizeLocation(p["Remote/Location"]) === activeLoc;

      return matchesSearch && matchesLoc;
    });

    render(filtered);
  }

  clearBtn.onclick = () => {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";
    populateFilters();
    render(people);
  };

  searchBox.oninput = applyFilters;

  functionFilter.onchange = () => {
    locationFilter.value = "";
    applyFilters();
  };

  locationFilter.onchange = applyFilters;

  populateFilters();
  renderDashboard();
  render(people);
}

loadDirectory();