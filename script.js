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
  let selectedRegion = "";
  const shortlist = window.TalentShortlist;
  let shortlistStorage;
  try { shortlistStorage = window.sessionStorage; } catch { shortlistStorage = null; }
  const shortlistDraft = shortlist.draftFrom(shortlistStorage);
  const shortlistLink = document.getElementById("createShortlist");
  function updateShortlistLink() {
    const count = shortlistDraft.items.length;
    shortlistLink.textContent = count ? `Create shortlist (${count})` : "Create shortlist";
    shortlistLink.href = count
      ? `shortlist-builder.html#from=${shortlist.encode({ ...shortlistDraft, title: shortlistDraft.title || "Recruiter shortlist" })}`
      : "shortlist-builder.html";
  }
  updateShortlistLink();



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


  function getWorkPreference(person) {
    return getValue(person, [
      "Work Preference",
      "Work Preferences",
      "workPreference"
    ]);
  }


  function getRelocationPreference(person) {
    return getValue(person, [
      "Open to Relocation",
      "Relocation",
      "relocationPreference"
    ]);
  }


  function getYearsExperience(person) {
    return getValue(person, [
      "Years of Experience",
      "Years Experience",
      "yearsExperience"
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
    return getSkills(person)
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
    if (selectedRegion) activeFilters.push({
      label: `Region: ${selectedRegion}`,
      clear: () => { selectedRegion = ""; applyFilters(); }
    });

    const selectedFunction =
      functionFilter.value.trim();

    if (selectedFunction) {
      activeFilters.push({
        label: `Function: ${selectedFunction}`,
        clear: () => {
          functionFilter.value = "";
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
            ${escapeHtml(filter.label.replace(/^(Function|Location): /, ""))}
            <button
              type="button"
              class="filter-breadcrumb-remove"
              aria-label="Remove ${escapeHtml(filter.label)} filter"
            >
              ×
            </button>
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

    if (currentValue) {
      if (!counts[currentValue]) {
        const option = document.createElement("option");
        option.value = currentValue;
        option.textContent = `${currentValue} (0)`;
        locationFilter.appendChild(option);
      }
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
            "button"
          );

        el.type = "button";
        el.className =
          "function-card";

        el.innerHTML = `
          <div class="function-name">
            ${escapeHtml(fn)}
          </div>

          <div class="function-value">
            ${count}
          </div>
        `;

        el.onclick = () => {
          functionFilter.value =
            fn;

          applyFilters();

          document
            .getElementById(
              "directory"
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
            "button"
          );

        el.type = "button";
        el.className =
          "function-card";

        el.innerHTML = `
          <div class="function-name">
            ${escapeHtml(region)}
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
              "directory"
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
          <p>Try a different search, broaden your filters, or check your spelling. You can also <a href="#directory-section" class="empty-state-link">clear all filters</a> to see all talent.</p>
        </div>
      `;

      container.querySelector(".empty-state-link").onclick = (event) => {
        event.preventDefault();
        clearBtn.click();
        searchBox.focus();
      };

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

        const workPreference =
          getWorkPreference(
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
          <label class="shortlist-selection"><input class="select-for-shortlist" type="checkbox" aria-label="Add ${escapeHtml(name)} to recruiter shortlist"> Add to shortlist</label>
          <h3>
            ${escapeHtml(name)}
          </h3>

          <p class="role">
            ${role ? `Previously: ${escapeHtml(role)}` : ""}
          </p>

          <div class="candidate-context">
            ${fn ? `<span>${escapeHtml(fn)}</span>` : ""}
            ${fn && (rawLocation || workPreference) ? `<span aria-hidden="true">·</span>` : ""}
            ${rawLocation ? `<span>Location: ${escapeHtml(rawLocation)}</span>` : ""}
            ${rawLocation && workPreference ? `<span aria-hidden="true">·</span>` : ""}
            ${workPreference ? `<span>${escapeHtml(workPreference.replace(/,/g, " /"))}</span>` : ""}
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

          ${summary ? `
            <div class="description-wrap">
              <p class="description">${escapeHtml(summary)}</p>
              <button class="description-toggle" type="button" aria-expanded="false">
                Read more ↓
              </button>
            </div>
          ` : ""}

          <div class="card-footer">
            <span class="availability ${activelySearching ? "active" : "unverified"}">
              <span class="status-dot" aria-hidden="true"></span>
              ${activelySearching ? "Actively searching" : "Availability unverified"}
            </span>
            <div class="candidate-links">${renderLinkedIn(person)}
              <button class="share-candidate clear-btn" type="button" aria-label="Copy profile link for ${escapeHtml(name)}">Share profile</button>
            </div>
          </div>
        `;

        container
          .appendChild(card);

        const shortlistCheckbox = card.querySelector(".select-for-shortlist");
        const profileId = shortlist.personId(person);
        shortlistCheckbox.checked = shortlistDraft.items.some(item => item.id === profileId);
        shortlistCheckbox.onchange = () => {
          if (shortlistCheckbox.checked) {
            if (shortlistDraft.items.length >= shortlist.MAX_ITEMS) {
              shortlistCheckbox.checked = false;
              document.getElementById("shareStatus").textContent = `A shortlist can include up to ${shortlist.MAX_ITEMS} people.`;
              return;
            }
            shortlistDraft.items.push({ id: profileId, role: "", url: "", note: "" });
          } else shortlistDraft.items = shortlistDraft.items.filter(item => item.id !== profileId);
          shortlist.saveDraft(shortlistStorage, shortlistDraft);
          updateShortlistLink();
          document.getElementById("shareStatus").textContent = `${shortlistDraft.items.length} people selected. Choose Create shortlist to add roles and share.`;
        };

        card.querySelector(".share-candidate").onclick = () => {
          const url = new URL(window.location.href);
          url.search = "";
          url.hash = "directory-section";
          url.searchParams.set("search", name);
          url.searchParams.set("expand", "1");
          copyLink(url.href);
        };

        const description =
          card.querySelector(".description");

        const toggle =
          card.querySelector(".description-toggle");

        if (description && toggle) {
          const params =
            new URLSearchParams(window.location.search);

          const directSearch =
            (params.get("search") || "")
              .toLowerCase()
              .trim();

          const shouldAutoExpand =
            params.get("expand") === "1" &&
            directSearch ===
              name.toLowerCase().trim();

          const updateToggleVisibility = () => {
            if (card.classList.contains("expanded")) {
              toggle.hidden = false;
              return;
            }

            toggle.hidden =
              description.scrollHeight <=
              description.clientHeight + 2;
          };

          if (shouldAutoExpand) {
            card.classList.add("expanded");
            toggle.setAttribute("aria-expanded", "true");
            toggle.textContent = "Show less ↑";
          }

          toggle.onclick = () => {
            const expanded =
              card.classList.toggle("expanded");

            toggle.setAttribute(
              "aria-expanded",
              expanded ? "true" : "false"
            );

            toggle.textContent =
              expanded
                ? "Show less ↑"
                : "Read more ↓";
          };

          requestAnimationFrame(
            updateToggleVisibility
          );
        }
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

    selectedRegion = region;
    applyFilters();
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

          const searchableFields = [
            getName(person),
            getRole(person),
            getTeam(person),
            getFunction(person),
            getRawLocation(person),
            getWorkPreference(person),
            getRelocationPreference(person),
            getYearsExperience(person),
            getDescription(person),
            getSkills(person),
            getCompany(person),
            getLinkedIn(person)
          ];

          const matchesSearch = window.DirectorySearch.matches(q, searchableFields);

          return (
            matchesLocation &&
            (!selectedRegion || getRegion(getRawLocation(person)) === selectedRegion) &&
            matchesSearch
          );
        }
      );

    render(filtered);
    updateFilterBreadcrumb();
    renderFunctionChips();
    syncSearchUrl();
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
    selectedRegion = "";

    populateFunctionFilter();
    populateLocationFilter(
      people
    );

    applyFilters();
  };


  searchBox.oninput =
    debouncedSearch;


  functionFilter.onchange =
    () => {
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

  function renderFunctionChips() {
    const chips = document.getElementById("functionChips");
    chips.replaceChildren();
    const entries = [["", people.length], ...Object.entries(countBy(people, getFunction))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))];
    for (const [value, count] of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "function-chip";
      button.setAttribute("aria-pressed", String(functionFilter.value === value));
      button.textContent = `${value || "All talent"} (${count})`;
      button.onclick = () => {
        functionFilter.value = value;
        applyFilters();
        // Keep keyboard focus on the selected chip after rerendering.
        Array.from(chips.children).find((chip) => chip.textContent === button.textContent)?.focus();
      };
      chips.appendChild(button);
    }
  }

  function syncSearchUrl() {
    const url = new URL(window.location.href);
    for (const [key, value] of [["search", searchBox.value.trim()],
      ["function", functionFilter.value], ["location", locationFilter.value], ["region", selectedRegion]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (!searchBox.value.trim()) url.searchParams.delete("expand");
    window.history.replaceState(null, "", url);
  }

  async function copyLink(value) {
    const status = document.getElementById("shareStatus");
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = "Link copied. Ready to share.";
    } catch {
      // A manual copy option also works when clipboard access is unavailable.
      status.replaceChildren();
      const label = document.createElement("label");
      label.textContent = "Copy this link: ";
      const field = document.createElement("input");
      field.type = "text";
      field.readOnly = true;
      field.value = value;
      label.appendChild(field);
      status.appendChild(label);
      field.focus();
      field.select();
    }
  }

  document.getElementById("shareSearch").onclick = () => {
    clearTimeout(searchTimeout);
    applyFilters();
    copyLink(window.location.href);
  };

  const params = new URLSearchParams(window.location.search);
  selectedRegion = params.get("region") || "";
  searchBox.value = params.get("search") || "";
  // Preserve shared links created before slash-spacing normalization.
  functionFilter.value = (params.get("function") || "").replace(/\s*\/\s*/g, " / ");
  populateLocationFilter(people);
  locationFilter.value = params.get("location") || "";
  applyFilters();

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
          <p>Please refresh the page to try again.</p>
        </div>
      `;
    }
  }
);
