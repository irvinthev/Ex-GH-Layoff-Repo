async function loadDirectory() {
  /* =====================
     LOAD DATA
  ===================== */

  const [peopleRes, placedRes] = await Promise.all([
    fetch("./people.json"),
    fetch("./placed.json")
  ]);

  if (!peopleRes.ok) {
    throw new Error(
      `Failed to load people.json: ${peopleRes.status}`
    );
  }

  if (!placedRes.ok) {
    throw new Error(
      `Failed to load placed.json: ${placedRes.status}`
    );
  }

  const people = await peopleRes.json();
  const placedPeople = await placedRes.json();


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

  const totalProfilesStat =
    document.getElementById("totalProfilesStat");

  const placedStat =
    document.getElementById("placedStat");

  const placementsStat =
    document.getElementById("placementsStat");

  const totalCount =
    document.getElementById("totalCount");

  const placementRateStat =
    document.getElementById("placementRateStat");

  const companiesStat =
    document.getElementById("companiesStat");

  const functionCount =
    document.getElementById("functionCount");

  const resultsCount =
    document.getElementById("resultsCount");

  const functionDashboard =
    document.getElementById("functionDashboard");

  const locationDashboard =
    document.getElementById("locationDashboard");

  let recentOnly = false;


  /* =====================
     RECENTLY ADDED BUTTON
  ===================== */

  const recentBtn =
    document.createElement("button");

  recentBtn.type = "button";
  recentBtn.id = "recentFilter";
  recentBtn.className = "recent-filter-btn";
  recentBtn.textContent = "Recently Added";

  clearBtn.parentNode.insertBefore(
    recentBtn,
    clearBtn
  );


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


  function getDateAdded(person) {
    return getValue(person, [
      "Date Added",
      "dateAdded"
    ]);
  }


  /* =====================
     PERSON / PLACEMENT HELPERS
  ===================== */

  function normalizePersonPart(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }


  function getPersonKey(person) {
    const first =
      normalizePersonPart(
        getValue(person, [
          "First Name",
          "firstName"
        ])
      );

    const last =
      normalizePersonPart(
        getValue(person, [
          "Last Name",
          "lastName"
        ])
      );

    if (!first && !last) {
      return "";
    }

    return `${first}|${last}`;
  }


  function isPlaced(person) {
    const flag =
      getValue(person, [
        "Placement Flag",
        "placementFlag",
        "Status"
      ]).toLowerCase();

    return flag === "placed";
  }


  function getPlacedCompany(person) {
    return getValue(person, [
      "Company Clean",
      "companyClean",
      "Company",
      "company"
    ]);
  }


  function normalizeCompany(company) {
    return String(company || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }


  /* =====================
     LIVE HOMEPAGE STATS
  ===================== */

  function renderHomepageStats() {
    /*
      people.json
      = people currently searching

      placed.json
      = placement history

      A person may appear multiple times in placed.json
      if they had multiple placement events.
    */

    const confirmedPlacements =
      placedPeople.filter(isPlaced);


    /* ---------------------
       UNIQUE PEOPLE SEARCHING
    --------------------- */

    const searchingKeys = new Set(
      people
        .map(getPersonKey)
        .filter(Boolean)
    );

    const stillLookingCount =
      searchingKeys.size;


    /* ---------------------
       UNIQUE PEOPLE PLACED
    --------------------- */

    const placedKeys = new Set(
      confirmedPlacements
        .map(getPersonKey)
        .filter(Boolean)
    );

    const peoplePlacedCount =
      placedKeys.size;


    /* ---------------------
       TOTAL PLACEMENT EVENTS
    --------------------- */

    const placementCount =
      confirmedPlacements.length;


    /* ---------------------
       UNIQUE PEOPLE TRACKED
    --------------------- */

    const allTrackedKeys = new Set([
      ...searchingKeys,
      ...placedKeys
    ]);

    const peopleTrackedCount =
      allTrackedKeys.size;


    /* ---------------------
       PLACEMENT RATE
    --------------------- */

    const placementRate =
      peopleTrackedCount > 0
        ? Math.round(
            (
              peoplePlacedCount /
              peopleTrackedCount
            ) * 100
          )
        : 0;


    /* ---------------------
       DESTINATION COMPANIES
    --------------------- */

    const uniqueCompanies = new Set(
      confirmedPlacements
        .map(getPlacedCompany)
        .map(normalizeCompany)
        .filter((company) => {
          return (
            company &&
            company !== "tbd" &&
            company !== "contractor" &&
            company !== "startup"
          );
        })
    );


    /* ---------------------
       RENDER METRICS
    --------------------- */

    if (totalProfilesStat) {
      totalProfilesStat.textContent =
        peopleTrackedCount;
    }

    if (placedStat) {
      placedStat.textContent =
        peoplePlacedCount;
    }

    if (placementsStat) {
      placementsStat.textContent =
        placementCount;
    }

    if (totalCount) {
      totalCount.textContent =
        stillLookingCount;
    }

    if (placementRateStat) {
      placementRateStat.textContent =
        `${placementRate}%`;
    }

    if (companiesStat) {
      companiesStat.textContent =
        uniqueCompanies.size;
    }
  }


  /* =====================
     NEW PROFILE LOGIC
  ===================== */

  function isNewProfile(person) {
    const rawDate =
      getDateAdded(person);

    // Blank = legacy profile, not new
    if (!rawDate) {
      return false;
    }

    const added =
      new Date(
        `${rawDate}T00:00:00`
      );

    // Invalid date = not new
    if (
      Number.isNaN(
        added.getTime()
      )
    ) {
      return false;
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const diffMilliseconds =
      today.getTime() -
      added.getTime();

    const diffDays =
      Math.floor(
        diffMilliseconds /
        (1000 * 60 * 60 * 24)
      );

    // 0–14 days = NEW
    return (
      diffDays >= 0 &&
      diffDays <= 14
    );
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


  function normalizeText(value) {
    return String(
      value || ""
    ).trim();
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


  function slugify(value) {
    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[\/,]/g, " ")
      .replace(/\s+/g, "-")
      .replace(
        /[^a-z0-9-]/g,
        ""
      );
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
        href="${raw}"
        target="_blank"
        rel="noopener noreferrer"
        class="linkedin"
      >
        View Profile →
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

    if (functionCount) {
      functionCount.textContent =
        Object.keys(
          functionCounts
        ).length;
    }
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
          No matches found. Try a different search
          or clear filters.
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

        const description =
          getDescription(
            person
          );

        const fn =
          getFunction(person);

        const newProfile =
          isNewProfile(
            person
          );

        const card =
          document.createElement(
            "article"
          );

        card.className =
          "card";

        card.innerHTML = `
          <div class="badge-row">

            ${
              fn
                ? `
                  <div
                    class="badge badge-${slugify(fn)}"
                  >
                    ${fn}
                  </div>
                `
                : ""
            }

            ${
              newProfile
                ? `
                  <div class="new-badge">
                    NEW
                  </div>
                `
                : ""
            }

          </div>

          <h3>
            ${name}
          </h3>

          <p class="role">
            ${role}
          </p>

          ${
            rawLocation
              ? `
                <div class="meta">
                  📍 ${rawLocation}
                </div>
              `
              : ""
          }

          ${
            description
              ? `
                <p class="description">
                  ${shortDescription(
                    description
                  )}
                </p>
              `
              : ""
          }

          <div class="footer">
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

  function updateRecentButton() {
    recentBtn.classList.toggle(
      "active",
      recentOnly
    );

    recentBtn.textContent =
      recentOnly
        ? "✓ Recently Added"
        : "Recently Added";
  }


  function applyRegionFilter(
    region
  ) {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";

    recentOnly = false;

    updateRecentButton();

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

    if (recentOnly) {
      functionFiltered =
        functionFiltered.filter(
          (person) =>
            isNewProfile(
              person
            )
        );
    }

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
  }


  /* =====================
     EVENTS
  ===================== */

  recentBtn.onclick = () => {
    recentOnly =
      !recentOnly;

    updateRecentButton();
    applyFilters();
  };


  clearBtn.onclick = () => {
    searchBox.value = "";
    functionFilter.value = "";
    locationFilter.value = "";

    recentOnly = false;

    updateRecentButton();

    populateFunctionFilter();
    populateLocationFilter(
      people
    );

    render(people);
  };


  searchBox.oninput =
    applyFilters;


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

  updateRecentButton();

  renderHomepageStats();

  renderDashboard();

  render(people);
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
          Something broke while loading the directory.
          Check people.json, placed.json, and file paths.
        </div>
      `;
    }
  }
);