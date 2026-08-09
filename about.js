async function loadAboutPage() {
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

  const peopleTrackedEl =
    document.getElementById("aboutPeopleTracked");

  const stillLookingEl =
    document.getElementById("aboutStillLooking");

  const peoplePlacedEl =
    document.getElementById("aboutPeoplePlaced");

  const placementsEl =
    document.getElementById("aboutPlacements");

  const placementRateEl =
    document.getElementById("aboutPlacementRate");

  const destinationCompaniesEl =
    document.getElementById("aboutDestinationCompanies");

  const companyTable =
    document.getElementById("destinationCompanyTable");


  /* =====================
     GENERIC HELPERS
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


  function displayCompanyName(company) {
    const normalized =
      normalizeCompany(company);

    /*
      Known aliases we can safely normalize.
      Add more here over time as needed.
    */

    const aliases = {
      "doordash": "DoorDash",
      "draftkings": "DraftKings",
      "draft kings": "DraftKings",
      "braze": "Braze",
      "uber": "Uber",
      "toast": "Toast",
      "oura": "Oura",
      "gusto": "Gusto",
      "yelp": "Yelp",
      "zillow": "Zillow",
      "zendesk": "Zendesk",
      "netflix": "Netflix",
      "spotify": "Spotify",
      "google": "Google",
      "servicenow": "ServiceNow",
      "paypal": "PayPal",
      "capital one": "Capital One",
      "bank of america": "Bank of America"
    };

    if (aliases[normalized]) {
      return aliases[normalized];
    }

    /*
      Otherwise preserve the original company name
      from the source as much as possible.
    */

    return String(company || "").trim();
  }


  /* =====================
     CONFIRMED PLACEMENTS
  ===================== */

  const confirmedPlacements =
    placedPeople.filter(isPlaced);


  /* =====================
     UNIQUE PEOPLE SEARCHING
  ===================== */

  const searchingKeys = new Set(
    people
      .map(getPersonKey)
      .filter(Boolean)
  );

  const stillLookingCount =
    searchingKeys.size;


  /* =====================
     UNIQUE PEOPLE PLACED
  ===================== */

  const placedKeys = new Set(
    confirmedPlacements
      .map(getPersonKey)
      .filter(Boolean)
  );

  const peoplePlacedCount =
    placedKeys.size;


  /* =====================
     TOTAL PLACEMENT EVENTS
  ===================== */

  const placementCount =
    confirmedPlacements.length;


  /* =====================
     UNIQUE PEOPLE TRACKED
  ===================== */

  const allTrackedKeys = new Set([
    ...searchingKeys,
    ...placedKeys
  ]);

  const peopleTrackedCount =
    allTrackedKeys.size;


  /* =====================
     PLACEMENT RATE
  ===================== */

  const placementRate =
    peopleTrackedCount > 0
      ? Math.round(
          (
            peoplePlacedCount /
            peopleTrackedCount
          ) * 100
        )
      : 0;


  /* =====================
     COMPANY COUNTS
  ===================== */

  const companyCounts = {};

  confirmedPlacements.forEach((person) => {
    const rawCompany =
      getPlacedCompany(person);

    const normalizedCompany =
      normalizeCompany(rawCompany);

    /*
      Ignore placeholder/non-company values.
    */

    if (
      !normalizedCompany ||
      normalizedCompany === "tbd" ||
      normalizedCompany === "contractor" ||
      normalizedCompany === "startup"
    ) {
      return;
    }

    /*
      Normalize known naming variants.
    */

    let companyKey =
      normalizedCompany;

    if (
      companyKey === "draft kings"
    ) {
      companyKey = "draftkings";
    }

    if (
      companyKey === "doordash "
    ) {
      companyKey = "doordash";
    }

    if (!companyCounts[companyKey]) {
      companyCounts[companyKey] = {
        name: displayCompanyName(rawCompany),
        count: 0
      };
    }

    companyCounts[companyKey].count += 1;
  });


  const companyEntries =
    Object.values(companyCounts)
      .sort((a, b) => {
        return (
          b.count - a.count ||
          a.name.localeCompare(b.name)
        );
      });


  const destinationCompanyCount =
    companyEntries.length;


  /* =====================
     RENDER METRICS
  ===================== */

  if (peopleTrackedEl) {
    peopleTrackedEl.textContent =
      peopleTrackedCount;
  }

  if (stillLookingEl) {
    stillLookingEl.textContent =
      stillLookingCount;
  }

  if (peoplePlacedEl) {
    peoplePlacedEl.textContent =
      peoplePlacedCount;
  }

  if (placementsEl) {
    placementsEl.textContent =
      placementCount;
  }

  if (placementRateEl) {
    placementRateEl.textContent =
      `${placementRate}%`;
  }

  if (destinationCompaniesEl) {
    destinationCompaniesEl.textContent =
      destinationCompanyCount;
  }


  /* =====================
     RENDER COMPANY CHART
  ===================== */

  if (companyTable) {
    companyTable.innerHTML = "";

    /*
      Show top 15 initially.
    */

    const topCompanies =
      companyEntries.slice(0, 15);

    if (!topCompanies.length) {
      companyTable.innerHTML = `
        <div class="company-bar-row">
          <span class="company-name">No placement data available.</span>
          <div class="bar-container"><div class="bar" style="width: 0%"></div></div>
          <span class="company-count">0</span>
        </div>
      `;
      return;
    }

    /* Find max count for bar scaling */
    const maxCount = Math.max(
      ...topCompanies.map(c => c.count)
    );

    topCompanies.forEach((company) => {
      const row =
        document.createElement("div");

      row.className =
        "company-bar-row";

      /* Calculate bar width percentage */
      const barWidthPercent =
        (company.count / maxCount) * 100;

      row.innerHTML = `
        <span class="company-name">${company.name}</span>
        <div class="bar-container">
          <div class="bar" style="width: ${barWidthPercent}%"></div>
        </div>
        <span class="company-count">${company.count}</span>
      `;

      companyTable.appendChild(row);
    });
  }
}


/* =====================
   ERROR HANDLING
===================== */

loadAboutPage().catch((error) => {
  console.error(
    "Failed to load About page data:",
    error
  );

  const companyTable =
    document.getElementById(
      "destinationCompanyTable"
    );

  if (companyTable) {
    companyTable.innerHTML = `
      <div class="company-bar-row">
        <span class="company-name">
          Placement data could not be loaded.
        </span>
        <div class="bar-container"><div class="bar" style="width: 0%"></div></div>
        <span class="company-count">0</span>
      </div>
    `;
  }
});
