async function loadDirectory() {
  /* =====================
     LOAD DATA
  ===================== */

  const res = await fetch("./people.json");

  if (!res.ok) {
    throw new Error(
      `Failed to load people.json: ${res.status}`
    );
  }

  const people = await res.json();


  /* =====================
     DOM ELEMENTS
  ===================== */

  const container =
    document.getElementById("directory");

  const searchBox =
    document.getElementById("search");

  const functionFilter =
    document.getElementById("functionFilter");

  const locationFilter =
    document.getElementById("locationFilter");

  const clearBtn =
    document.getElementById("clearFilters");

  const totalCount =
    document.getElementById("totalCount");

  const functionCount =
    document.getElementById("functionCount");

  const heroTalentCount =
    document.getElementById("heroTalentCount");

  const resultsCount =
    document.getElementById("resultsCount");

  const functionDashboard =
    document.getElementById("functionDashboard");

  const locationDashboard =
    document.getElementById("locationDashboard");

  const filterBreadcrumb =
    document.getElementById("filterBreadcrumb");

  let searchTimeout = null;


  /* =====================
     DATA HELPERS
  ===================== */

  function getValue(person, keys) {
    for (const key of keys) {
      const value = person[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return String(value).trim();
      }
    }

    return "";
  }


  function getName(person) {
    const fullName =
      getValue(person, [
        "name",
        "fullName"
      ]);

    if (fullName) {
      return fullName;
    }

    const first =
      getValue(person, [
        "First Name",
        "firstName"
      ]);

    const last =
      getValue(person, [
        "Last Name",
        "lastName"
      ]);

    return `${first} ${last}`.trim();
  }


  function getRole(person) {
    return getValue(person, [
      "formerRole",
      "Former Role",
      "Former Job Title",
      "role"
    ]);
  }


  function getTeam(person) {
    return getValue(person, [
      "Former Team",
      "Team",
      "formerTeam"
    ]);
  }


  function getFunction(person) {
    return getValue(person, [
      "function",
      "Function"
    ]);
  }


  function getCompany(person) {
    return (
      getValue(person, [
        "company",
        "Company"
      ]) || "Grubhub"
    );
  }


  function getRawLocation(person) {
    return getValue(person, [
      "location",
      "Location",
      "Remote/Location"
    ]);
  }


  function getLinkedIn(person) {
    return getValue(person, [
      "linkedin",
      "LinkedIn",
      "Linkedin",
      "Linked In",
      "LinkedIn URL"
    ]);
  }


  function getSkills(person) {
    const skills = getValue(person, [
      "Top 3 Skills",
      "topSkills",
      "skills",
      "Skills"
    ]);

    return skills.startsWith("=AI(")
      ? ""
      : skills;
  }


  function isActivelySearching(person) {
    const value = getValue(person, [
      "Open to Work",
      "openToWork",
      "availability"
    ]).toLowerCase();

    return ["yes", "true", "active", "actively searching"].includes(value);
  }


  /* =====================
     DESCRIPTION
  ===================== */

  function getDescription(person) {
    let desc =
      getValue(person, [
        "description",
        "Description",
        "Short Description"
      ]);

    if (!desc) {
      return "";
    }

    desc =
      desc.replace(
        /most recently served as[^.]*\.\s*/i,
        ""
      );

    return desc.trim();
  }


  function getProfileSummary(person) {
    const description = getDescription(person);

    if (!description) {
      return "";
    }

    return description
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean)[0] || "";
  }


  function getDisplayTags(person) {
    const descriptionLines = getDescription(person)
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean);

    const tagSource = descriptionLines.length > 1
      ? descriptionLines[descriptionLines.length - 1]
      : getSkills(person);

    return tagSource
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 3);
  }


  function normalizeText(value) {
    return String(
      value || ""
    ).trim();
  }


  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function shortDescription(text) {
    const clean =
      normalizeText(text);

    if (!clean) {
      return "";
    }

    return clean.length > 140
      ? `${clean
          .slice(0, 140)
          .trim()}...`
      : clean;
  }


  /* =====================
     LOCATION
  ===================== */

  function normalizeLocation(value) {
    const v =
      String(
        value || ""
      )
        .toLowerCase()
        .trim();

    if (!v) {
      return "Unknown";
    }

    if (
      v.includes("new york") ||
      v.includes("nyc") ||
      v.includes("ny city") ||
      v.includes("new york city")
    ) {
      return "New York";
    }

    if (
      v.includes("chicago")
    ) {
      return "Chicago";
    }

    if (
      v.includes("boston")
    ) {
      return "Boston";
    }

    if (
      v.includes("san francisco") ||
      v.includes("bay area")
    ) {
      return "SF Bay Area";
    }

    if (
      v.includes("los angeles")
    ) {
      return "Los Angeles";
    }

    if (
      v.includes("seattle")
    ) {
      return "Seattle";
    }

    if (
      v.includes("oakland")
    ) {
      return "Oakland";
    }

    if (
      v.includes("denver") ||
      v.includes("broomfield") ||
      v.includes("colorado")
    ) {
      return "Colorado";
    }

    if (
      v.includes("austin")
    ) {
      return "Austin";
    }

    if (
      v.includes("tucson")
    ) {
      return "Tucson";
    }

    if (
      v.includes("rhode island")
    ) {
      return "Rhode Island";
    }

    if (
      v.includes("north carolina")
    ) {
      return "North Carolina";
    }

    if (
      v.includes("romania")
    ) {
      return "Romania";
    }

    if (
      v.includes("remote") ||
      v.includes("anywhere")
    ) {
      return "Remote";
    }

    return value || "Other";
  }


  function getRegion(value) {
    const v =
      String(
        value || ""
      )
        .toLowerCase()
        .trim();

    if (!v) {
      return "Unknown";
    }

    if (
      v.includes("remote") ||
      v.includes("anywhere")
    ) {
      return "Remote";
    }

    if (
      v.includes("new york") ||
      v.includes("nyc") ||
      v.includes("ny city") ||
      v.includes("new york city") ||
      v.includes("boston") ||
      v.includes("rhode island") ||
      v.includes("north carolina")
    ) {
      return "East Coast";
    }

    if (
      v.includes("chicago") ||
      v.includes("ohio")
    ) {
      return "Midwest";
    }

    if (
      v.includes("san francisco") ||
      v.includes("bay area") ||
      v.includes("los angeles") ||
      v.includes("seattle") ||
      v.includes("oakland")
    ) {
      return "West Coast";
    }

    if (
      v.includes("denver") ||
      v.includes("broomfield") ||
      v.includes("colorado") ||
      v.includes("austin") ||
      v.includes("texas") ||
      v.includes("tucson")
    ) {
      return "Central / Mountain";
    }

    if (
      v.includes("romania")
    ) {
      return "International";
    }

    return "Other";
  }


  /* =====================
     LINKEDIN
  ===================== */

  function renderLinkedIn(person) {
    let raw =
      getLinkedIn(person)
        .trim();

    if (!raw) {
      return `
        <span class="linkedin pending">
          Profile pending
        </span>
      `;
    }

    const lower =
      raw.toLowerCase();

    const looksLikeLabelOnly =
      lower.includes("linkedin") &&
      !lower.includes(
        "linkedin.com"
      );

    if (
      looksLikeLabelOnly
    ) {
      return `
        <span class="linkedin pending">
          Profile pending
        </span>
      `;
    }

    if (
      raw.includes(
        "linkedin.com"
      ) &&
      !raw.startsWith(
        "http://"
      ) &&
      !raw.startsWith(
        "https://"
      )
    ) {
      raw =
        `https://${raw}`;
    }

    const isValid =
      /^https?:\/\/(www\.)?linkedin\.com\//i
        .test(raw);

    if (!isValid) {
      return `
        <span class="linkedin pending">
          Profile pending
        </span>
      `;
    }

    return `
      <a
        href="${escapeHtml(raw)}"
        target="_blank"
        rel="noopener noreferrer"
        class="linkedin"
      >
        View LinkedIn →
      </a>
    `;
  }


  /* =====================
     COUNTS
  ===================== */

  function uniqueValuesFromPeople(
    list,
    getter
  ) {
    return [
      ...new Set(
        list
          .map(getter)
          .filter(Boolean)
      )
    ].sort(
      (a, b) =>
        a.localeCompare(b)
    );
  }


  function countBy(
    list,
    getter
  ) {
    const counts = {};

    list.forEach(
      (person) => {
        const key =
          getter(person);

        if (key) {
          counts[key] =
            (counts[key] || 0) +
            1;
        }
      }
    );

    return counts;
  }


  /* =====================
     SUMMARY STATS
  ===================== */

  function renderSummaryStats() {
    const functionCounts =
      countBy(
        people,
        getFunction
      );

    if (totalCount) {
      totalCount.textContent =
        people.length;
    }

    if (heroTalentCount) {
      heroTalentCount.textContent =
        `${people.length} former Grubhub professionals`;
    }

    if (functionCount) {
      functionCount.textContent =
        Object.keys(
          functionCounts
        ).length;
    }

  }


  /* =====================
     FILTER BREADCRUMB
  ===================== */

  function updateFilterBreadcrumb() {
    if (!filterBreadcrumb) {
      return;
    }

    const activeFilters = [];

    const selectedFunction =
      functionFilter.value.trim();

    if (selectedFunction) {
      activeFilters.push({
        label: `Function: ${selectedFunction}`,
        clear: () => {
          functionFilter.value = "";
          locationFilter.value = "";
          applyFilters();
        }
      });
    }

    const selectedLocation =
      locationFilter.value.trim();

    if (selectedLocation) {
      activeFilters.push({
        label: `Location: ${selectedLocation}`,
        clear: () => {
          locationFilter.value = "";
          applyFilters();
        }
      });
    }

    const searchValue =
      searchBox.value.trim();

    if (searchValue) {
      activeFilters.push({
        label: `Search: "${searchValue}"`,
        clear: () => {
          searchBox.value = "";
          applyFilters();
        }
      });
    }

    if (activeFilters.length === 0) {
      filterBreadcrumb.innerHTML = "";
      return;
    }

    filterBreadcrumb.innerHTML = activeFilters
      .map(
        (filter) => `
          <div class="filter-breadcrumb-item">
            ${filter.label}
            <span 
              class="filter-breadcrumb-remove" 
              role="button" 
              tabindex="0"
              aria-label="Remove ${filter.label} filter"
            >
              ×
            </span>
          </div>
        `
      )
      .join("");

    const removeButtons =
      filterBreadcrumb.querySelectorAll(
        ".filter-breadcrumb-remove"
      );

    removeButtons.forEach(
      (btn, index) => {
        btn.onclick = () => {
          activeFilters[index].clear();
        };

        btn.onkeydown = (e) => {
          if (e.key === "Enter") {
            activeFilters[index].clear();
          }
        };
      }
    );
  }


  /* =====================
     FILTER CONTROLS
  ===================== */

  function populateFunctionFilter() {
    const currentValue =
      functionFilter.value;

    const functions =
      uniqueValuesFromPeople(
        people,
        getFunction
      );

    functionFilter.innerHTML =
      `<option value="">
        All Functions
      </option>`;

    functions.forEach(
      (fn) => {
        const option =
          document.createElement(
            "option"
          );

        option.value = fn;
        option.textContent = fn;

        functionFilter
          .appendChild(option);
      }
    );

    functionFilter.value =
      currentValue;
  }


  function populateLocationFilter(
    baseList
  ) {
    const currentValue =
      locationFilter.value;

    const counts =
      countBy(
        baseList,
        (person) =>
          normalizeLocation(
            getRawLocation(
              person
            )
          )
      );

    const entries =
      Object.entries(
        counts
      ).sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].localeCompare(
            b[0]
          )
      );

    locationFilter.innerHTML =
      `<option value="">
        All Locations
      </option>`;

    entries.forEach(
      ([location, count]) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          location;

        option.textContent =
          `${location} (${count})`;

        locationFilter
          .appendChild(option);
      }
    );

    if (
      currentValue &&
      counts[currentValue]
    ) {
      locationFilter.value =
        currentValue;
    } else {
      locationFilter.value =
        "";
    }
  }


  /* =====================
     DASHBOARD
  ===================== */

  function renderDashboard() {
    const functionCounts =
      countBy(
        people,
        getFunction
      );

    const regionCounts =
      countBy(
        people,
        (person) =>
          getRegion(
            getRawLocation(
              person
            )
          )
      );

    const functionEntries =
      Object.entries(
        functionCounts
      ).sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].localeCompare(
            b[0]
          )
      );

    const regionEntries =
      Object.entries(
        regionCounts
      ).sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].localeCompare(
            b[0]
          )
      );

    functionDashboard.innerHTML =
      "";

    locationDashboard.innerHTML =
      "";

    functionEntries.forEach(
      ([fn, count]) => {
        const el =
          document.createElement(
            "div"
          );

        el.className =
          "function-card";

        el.innerHTML = `
          <div class="function-name">
            ${fn}
          </div>

          <div class="function-value">
            ${count}
          </div>
        `;

        el.onclick = () => {
          functionFilter.value =
            fn;

          locationFilter.value =
            "";

          applyFilters();

          document
            .getElementById(
              "directory-section"
            )
            .scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
        };

        functionDashboard
          .appendChild(el);
      }
    );


    regionEntries.forEach(
      ([region, count]) => {
        const el =
          document.createElement(
            "div"
          );

        el.className =
          "function-card";

        el.innerHTML = `
          <div class="function-name">
            ${region}
          </div>

          <div class="function-value">
            ${count}
          </div>
        `;

        el.onclick = () => {
          applyRegionFilter(
            region
          );

          document
            .getElementById(
              "directory-section"
            )
            .scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
        };

        locationDashboard
          .appendChild(el);
      }
    );
  }


  /* =====================
     PROFILE CARDS
  ===================== */

  function render(list) {
    container.innerHTML =
      "";

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No matches found.</strong>
          <p>Try a different search, broaden your filters, or check your spelling. You can also <a href="javascript:clearFilters()" class="empty-state-link">clear all filters</a> to see all talent.</p>
        </div>
      `;

      if (resultsCount) {
        resultsCount.textContent =
          "0 results";
      }

      return;
    }

    if (resultsCount) {
      resultsCount.textContent =
        `${list.length} result${
          list.length === 1
            ? ""
            : "s"
        }`;
    }

    list.forEach(
      (person) => {
        const name =
          getName(person);

        const role =
          getRole(person);

        const rawLocation =
          getRawLocation(
            person
          );

        const summary =
          getProfileSummary(
            person
          );

        const fn =
          getFunction(person);

        const tags =
          getDisplayTags(person);

        const activelySearching =
          isActivelySearching(person);

        const card =
          document.createElement(
            "article"
          );

        card.className =
          "card";

        card.innerHTML = `
          <h3>
            ${escapeHtml(name)}
          </h3>

          <p class="role">
            ${escapeHtml(role)}
          </p>

          <div class="candidate-context">
            ${fn ? `<span>${escapeHtml(fn)}</span>` : ""}
            ${fn && rawLocation ? `<span aria-hidden="true">·</span>` : ""}
            ${rawLocation ? `<span>📍 ${escapeHtml(rawLocation)}</span>` : ""}
          </div>

          ${
            tags.length
              ? `
                <div class="skill-tags" aria-label="Professional strengths">
                  ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                </div>
              `
              : ""
          }

          ${summary ? `<p class="description">${escapeHtml(shortDescription(summary))}</p>` : ""}

          <div class="card-footer">
            <span class="availability ${activelySearching ? "active" : "unverified"}">
              <span class="status-dot" aria-hidden="true"></span>
              ${activelySearching ? "Actively searching" : "Availability unverified"}
            </span>
            ${renderLinkedIn(
              person
            )}
          </div>
        `;

        container
          .appendChild(card);
      }
    );
  }


  /* =====================
     FILTERING
  ===================== */

  function applyRegionFilter(
    region
  ) {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";

    const filtered =
      people.filter(
        (person) =>
          getRegion(
            getRawLocation(
              person
            )
          ) === region
      );

    populateLocationFilter(
      filtered
    );

    render(filtered);
    updateFilterBreadcrumb();
  }


  function applyFilters() {
    const q =
      searchBox.value
        .toLowerCase()
        .trim();

    const selectedFunction =
      functionFilter.value
        .trim();

    const selectedLocation =
      locationFilter.value
        .trim();

    let functionFiltered =
      people.filter(
        (person) => {
          return (
            !selectedFunction ||
            getFunction(
              person
            ) ===
              selectedFunction
          );
        }
      );

    populateLocationFilter(
      functionFiltered
    );

    if (selectedLocation) {
      locationFilter.value =
        selectedLocation;
    }

    const activeLocation =
      locationFilter.value
        .trim();

    const filtered =
      functionFiltered.filter(
        (person) => {
          const personLocation =
            normalizeLocation(
              getRawLocation(
                person
              )
            );

          const matchesLocation =
            !activeLocation ||
            personLocation ===
              activeLocation;

          const haystack = [
            getName(person),
            getRole(person),
            getTeam(person),
            getFunction(person),
            getRawLocation(person),
            getDescription(person),
            getSkills(person),
            getCompany(person),
            getLinkedIn(person)
          ]
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !q ||
            haystack.includes(
              q
            );

          return (
            matchesLocation &&
            matchesSearch
          );
        }
      );

    render(filtered);
    updateFilterBreadcrumb();
  }


  /* =====================
     DEBOUNCED SEARCH
  ===================== */

  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(
      () => {
        applyFilters();
      },
      300
    );
  }


  /* =====================
     EVENTS
  ===================== */

  clearBtn.onclick = () => {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";

    populateFunctionFilter();
    populateLocationFilter(
      people
    );

    render(people);
    updateFilterBreadcrumb();
  };


  searchBox.oninput =
    debouncedSearch;


  functionFilter.onchange =
    () => {
      locationFilter.value =
        "";

      applyFilters();
    };


  locationFilter.onchange =
    applyFilters;


  /* =====================
     INITIAL LOAD
  ===================== */

  populateFunctionFilter();

  populateLocationFilter(
    people
  );

  renderSummaryStats();

  renderDashboard();

  render(people);
  updateFilterBreadcrumb();
}


/* =====================
   ERROR HANDLING
===================== */

loadDirectory().catch(
  (error) => {
    console.error(
      "Failed to load directory:",
      error
    );

    const container =
      document.getElementById(
        "directory"
      );

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>Something broke while loading the directory.</strong>
          <p>Check people.json and file paths in your browser console for details.</p>
        </div>
      `;
    }
  }
);

