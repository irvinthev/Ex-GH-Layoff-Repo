/**
 * Talent Network Impact Widget - Phase 1
 * 
 * Displays three headline metrics and recent member activity.
 * Uses source JSON files as-is; does not deduplicate or reconcile identities.
 */

/* =====================
   DATE PARSING
===================== */

/**
 * Parses dates from the tracker.
 * Google Sheets currently outputs DD/MM/YYYY.
 * Falls back to standard JavaScript date parsing for ISO/other formats.
 */
function parseDate(value) {
  if (!value) return null;

  const raw = String(value).trim();

  // Handle DD/MM/YYYY
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);

    const date = new Date(year, month, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Returns true if the date is today. */
function isToday(date) {
  if (!date || !(date instanceof Date)) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Returns true if the date is within the rolling last 7 calendar days,
 * including today.
 */
function isWithinLast7Days(date) {
  if (!date || !(date instanceof Date)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const comparisonDate = new Date(date);
  comparisonDate.setHours(0, 0, 0, 0);

  return comparisonDate >= sevenDaysAgo && comparisonDate <= today;
}

/* =====================
   PROPERTY NORMALIZATION
===================== */

function normalizePropertyNames(record) {
  if (!record || typeof record !== 'object') return {};

  const normalized = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[String(key).trim()] = value;
  }
  return normalized;
}

/* =====================
   VALIDATION
===================== */

function isValidPerson(person) {
  if (!person || typeof person !== 'object') return false;

  const firstName = (person['First Name'] || '').trim();
  const lastName = (person['Last Name'] || '').trim();

  return firstName.length > 0 && lastName.length > 0;
}

function isOpenToWork(person) {
  const value = (person['Open to Work'] || '').trim().toLowerCase();

  return (
    value === '' ||
    value === 'yes' ||
    value === 'true' ||
    value === 'open to work'
  );
}

/* =====================
   METRIC CALCULATIONS
===================== */

function calculateMetrics(peopleList, placedList) {
  let openToWorkCount = 0;

  for (const rawPerson of peopleList) {
    const person = normalizePropertyNames(rawPerson);
    if (isValidPerson(person) && isOpenToWork(person)) {
      openToWorkCount++;
    }
  }

  let placedCount = 0;

  for (const rawPerson of placedList) {
    const person = normalizePropertyNames(rawPerson);
    if (isValidPerson(person)) {
      placedCount++;
    }
  }

  const totalPeopleSupported = openToWorkCount + placedCount;

  let newMembersLast7Days = 0;
  let newMembersToday = 0;

  for (const rawPerson of peopleList) {
    const person = normalizePropertyNames(rawPerson);

    if (!isValidPerson(person)) continue;

    let dateAdded = parseDate(person['Date Added']);
    if (!dateAdded) {
      dateAdded = parseDate(person['Timestamp']);
    }

    if (!dateAdded) continue;

    if (isWithinLast7Days(dateAdded)) {
      newMembersLast7Days++;
    }

    if (isToday(dateAdded)) {
      newMembersToday++;
    }
  }

  return {
    openToWork: openToWorkCount,
    placed: placedCount,
    peopleSupported: totalPeopleSupported,
    newMembersLast7Days,
    newMembersToday
  };
}

/* =====================
   FORMATTING
===================== */

function formatMetricNumber(value) {
  return value === null || value === undefined ? '—' : String(value);
}

function formatActivityValue(value) {
  return value === null || value === undefined ? '—' : `+${value}`;
}

/* =====================
   RENDERING
===================== */

function renderTalentImpactWidget(metrics) {
  const container = document.getElementById('talent-impact-widget');

  if (!container) {
    console.warn('talent-impact-widget container not found');
    return;
  }

  const openToWorkValue = formatMetricNumber(metrics.openToWork);
  const placedValue = formatMetricNumber(metrics.placed);
  const peopleSupportedValue = formatMetricNumber(metrics.peopleSupported);
  const newMembersLast7DaysValue = formatActivityValue(metrics.newMembersLast7Days);
  const newMembersTodayValue = formatActivityValue(metrics.newMembersToday);

  container.innerHTML = `
    <div class="talent-impact-container">
      <h2 class="impact-headline">Talent Network Impact</h2>
      <p class="impact-tagline">Real outcomes from our community</p>

      <div class="impact-metrics">
        <div class="impact-metric open-to-work">
          <div class="impact-number">${openToWorkValue}</div>
          <div class="impact-label">Open to Work</div>
        </div>

        <div class="impact-metric placed">
          <div class="impact-number">${placedValue}</div>
          <div class="impact-label">Placed</div>
        </div>

        <div class="impact-metric people-tracked">
          <div class="impact-number">${peopleSupportedValue}</div>
          <div class="impact-label">People Supported</div>
        </div>
      </div>

      <div class="impact-activity-strip">
        <div class="activity-title">Recent Activity</div>
        <dl class="activity-items">
          <dt class="activity-label">New Members — Last 7 Days</dt>
          <dd class="activity-value">${newMembersLast7DaysValue}</dd>

          <dt class="activity-label">Joined Today</dt>
          <dd class="activity-value">${newMembersTodayValue}</dd>
        </dl>
      </div>

      <p class="impact-footer">
        Updated automatically from the Ex-Grubhub Talent Network tracker.
      </p>
    </div>
  `;

  container.setAttribute('aria-busy', 'false');
}

function renderTalentImpactLoading(container) {
  if (!container) return;

  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `
    <div class="talent-impact-container">
      <p class="impact-loading">Loading Talent Network Impact...</p>
    </div>
  `;
}

function renderTalentImpactError(container, message) {
  if (!container) return;

  container.setAttribute('aria-busy', 'false');
  container.innerHTML = `
    <div class="talent-impact-container">
      <div class="impact-error">
        <p><strong>Unable to load Talent Network Impact.</strong></p>
        <p>${message}</p>
      </div>
    </div>
  `;
}

/* =====================
   DATA LOADING
===================== */

async function loadPeopleData() {
  const cacheBuster = `?t=${Date.now()}`;
  const res = await fetch(`./people.json${cacheBuster}`);

  if (!res.ok) {
    throw new Error(`Failed to load people.json: ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('people.json is not an array');
  }

  return data;
}

async function loadPlacedData() {
  const cacheBuster = `?t=${Date.now()}`;
  const res = await fetch(`./placed.json${cacheBuster}`);

  if (!res.ok) {
    throw new Error(`Failed to load placed.json: ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('placed.json is not an array');
  }

  return data;
}

/* =====================
   INITIALIZATION
===================== */

async function initTalentImpactWidget() {
  const container = document.getElementById('talent-impact-widget');

  if (!container) {
    console.warn('talent-impact-widget container not found');
    return;
  }

  renderTalentImpactLoading(container);

  try {
    const [peopleList, placedList] = await Promise.all([
      loadPeopleData(),
      loadPlacedData()
    ]);

    const metrics = calculateMetrics(peopleList, placedList);
    renderTalentImpactWidget(metrics);
  } catch (error) {
    console.error('Error loading Talent Network Impact:', error);
    renderTalentImpactError(container, error.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTalentImpactWidget);
} else {
  initTalentImpactWidget();
}
