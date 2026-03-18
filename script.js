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
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[\/,]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function normalizeLocation(v) {
    v = String(v || "").toLowerCase();

    if (v.includes("new york")) return "New York";
    if (v.includes("chicago")) return "Chicago";
    if (v.includes("boston")) return "Boston";
    if (v.includes("san francisco") || v.includes("bay area")) return "SF Bay Area";
    if (v.includes("los angeles")) return "Los Angeles";
    if (v.includes("seattle")) return "Seattle";
    if (v.includes("remote")) return "Remote";

    return "Other";
  }

  function getRegion(v) {
    v = String(v || "").toLowerCase();

    if (!v) return "Unknown";

    if (v.includes("new york") || v.includes("boston")) return "East Coast";
    if (v.includes("chicago")) return "Midwest";
    if (v.includes("san francisco") || v.includes("los angeles") || v.includes("seattle")) return "West Coast";
    if (v.includes("remote")) return "Remote";

    return "Other";
  }

  function populateFilters(base = people) {
    functionFilter.innerHTML = `<option value="">All Functions</option>`;

    [...new Set(people.map(p => p["Function"]).filter(Boolean))]
      .sort()
      .forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        functionFilter.appendChild(opt);
      });

    const counts = {};

    base.forEach(p => {
      const loc = normalizeLocation(p["Remote/Location"]);
      counts[loc] = (counts[loc] || 0) + 1;
    });

    locationFilter.innerHTML = `<option value="">All Locations</option>`;

    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([loc, count]) => {
        const opt = document.createElement("option");
        opt.value = loc;
        opt.textContent = `${loc} (${count})`;
        locationFilter.appendChild(opt);
      });
  }

  function renderDashboard() {
    const fnCounts = {};
    const regionCounts = {};

    people.forEach(p => {
      const fn = p["Function"];
      const region = getRegion(p["Remote/Location"]);

      fnCounts[fn] = (fnCounts[fn] || 0) + 1;
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    functionDashboard.innerHTML = "";
    locationDashboard.innerHTML = "";

    Object.entries(fnCounts).forEach(([k, v]) => {
      const el = document.createElement("div");
      el.className = "function-card";
      el.innerHTML = `<div>${k}</div><div>${v}</div>`;
      el.onclick = () => {
        functionFilter.value = k;
        locationFilter.value = "";
        applyFilters();
      };
      functionDashboard.appendChild(el);
    });

    Object.entries(regionCounts).forEach(([k, v]) => {
      const el = document.createElement("div");
      el.className = "function-card";
      el.innerHTML = `<div>${k}</div><div>${v}</div>`;
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

    list.forEach(p => {
      const name = `${p["First Name"] || ""} ${p["Name"] || ""}`.trim();
      const fn = p["Function"] || "";
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
    const q = searchBox.value.toLowerCase();
    const f = functionFilter.value;
    const l = locationFilter.value;

    const fnFiltered = people.filter(p =>
      !f || p["Function"] === f
    );

    populateFilters(fnFiltered);

    const activeLoc = locationFilter.value;

    const filtered = fnFiltered.filter(p => {
      const matchesSearch = Object.values(p)
        .some(v => String(v).toLowerCase().includes(q));

      const matchesLoc =
        !activeLoc ||
        normalizeLocation(p["Remote/Location"]) === activeLoc;

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