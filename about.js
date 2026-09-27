async function loadAboutPage() {
  const [peopleRes, placedRes] = await Promise.all([
    fetch("./people.json"),
    fetch("./placed.json")
  ]);

  if (!peopleRes.ok) throw new Error(`Failed to load people.json: ${peopleRes.status}`);
  if (!placedRes.ok) throw new Error(`Failed to load placed.json: ${placedRes.status}`);

  const people = await peopleRes.json();
  const placedPeople = await placedRes.json();

  const getValue = (record, keys) => {
    for (const key of keys) {
      const value = record?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const normalizePart = (value) =>
    String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

  const getPersonKey = (person) => {
    const first = normalizePart(getValue(person, ["First Name", "firstName"]));
    const last = normalizePart(getValue(person, ["Last Name", "lastName"]));
    return first || last ? `${first}|${last}` : "";
  };

  const isPlaced = (person) =>
    getValue(person, ["Placement Flag", "placementFlag", "Status"]).toLowerCase() === "placed";

  const parseDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isWithinLast7Days = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const candidate = new Date(date);
    candidate.setHours(0, 0, 0, 0);
    return candidate >= start && candidate <= today;
  };

  const confirmedPlacements = placedPeople.filter(isPlaced);

  const searchingKeys = new Set(people.map(getPersonKey).filter(Boolean));
  const placedKeys = new Set(confirmedPlacements.map(getPersonKey).filter(Boolean));
  const supportedKeys = new Set([...searchingKeys, ...placedKeys]);

  const recentKeys = new Set(
    people
      .filter((person) =>
        isWithinLast7Days(parseDate(getValue(person, ["Date Added", "Timestamp", "dateAdded"])))
      )
      .map(getPersonKey)
      .filter(Boolean)
  );

  const metrics = {
    aboutPeopleTracked: searchingKeys.size + placedKeys.size,
    aboutPeoplePlaced: placedKeys.size,
    aboutStillLooking: searchingKeys.size,
    aboutAddedLast7Days: recentKeys.size
  };

  for (const [id, value] of Object.entries(metrics)) {
    const el = document.getElementById(id);
    if (el) el.textContent = value.toLocaleString();
  }

  const normalizeCompany = (company) =>
    String(company || "").toLowerCase().replace(/\s+/g, " ").trim();

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

  const companyCounts = new Map();

  for (const person of confirmedPlacements) {
    const raw = getValue(person, ["Company Clean", "companyClean", "Company", "company"]);
    const normalized = normalizeCompany(raw);

    if (!normalized || ["tbd", "contractor", "startup"].includes(normalized)) continue;

    const key = normalized === "draft kings" ? "draftkings" : normalized;
    const existing = companyCounts.get(key) || {
      name: aliases[key] || String(raw).trim(),
      count: 0
    };
    existing.count += 1;
    companyCounts.set(key, existing);
  }

  const topCompanies = [...companyCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);

  const companyTable = document.getElementById("destinationCompanyTable");
  if (!companyTable) return;

  if (!topCompanies.length) {
    companyTable.innerHTML = '<p class="about-data-error">No placement data available.</p>';
    return;
  }

  const maxCount = Math.max(...topCompanies.map((company) => company.count));
  companyTable.innerHTML = "";

  for (const company of topCompanies) {
    const row = document.createElement("div");
    row.className = "about-company-row";
    const width = (company.count / maxCount) * 100;

    row.innerHTML = `
      <span class="about-company-name">${company.name}</span>
      <div class="about-company-bar-track" aria-hidden="true">
        <div class="about-company-bar" style="width: ${width}%"></div>
      </div>
      <span class="about-company-count">${company.count}</span>
    `;

    companyTable.appendChild(row);
  }
}

loadAboutPage().catch((error) => {
  console.error("Failed to load About page data:", error);

  for (const id of [
    "aboutPeopleTracked",
    "aboutPeoplePlaced",
    "aboutStillLooking",
    "aboutAddedLast7Days"
  ]) {
    const el = document.getElementById(id);
    if (el) el.textContent = "—";
  }

  const companyTable = document.getElementById("destinationCompanyTable");
  if (companyTable) {
    companyTable.innerHTML = '<p class="about-data-error">Placement data could not be loaded.</p>';
  }
});
