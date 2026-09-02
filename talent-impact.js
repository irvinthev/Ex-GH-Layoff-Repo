/**
 * Talent Network Impact Widget - Phase 1
 * 
 * Displays three headline metrics and a 24-hour activity strip.
 * Uses source JSON files as-is; does not deduplicate or reconcile identities.
 */

/* =====================
   DATE PARSING
===================== */

/**
 * Simple date parser. Accepts ISO format, US format, or other valid strings.
 * Returns Date object or null if invalid.
 */
function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Returns true if a date is within the last 24 hours.
 */
function isWithinLast24Hours(date) {
  if (!date || !(date instanceof Date)) {
    return false;
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return date >= twentyFourHoursAgo && date <= now;
}

/**
 * Returns true if a date is within the last 30 calendar days (including today).
 */
function isWithinLast30Days(date) {
  if (!date || !(date instanceof Date)) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  return date >= thirtyDaysAgo && date <= today;
}

/* =====================
   PROPERTY NORMALIZATION
===================== */

/**
 * Normalizes property names by trimming surrounding whitespace.
 */
function normalizePropertyNames(record) {
  if (!record || typeof record !== 'object') {
    return {};
  }

  const normalized = {};
  
  for (const [key, value] of Object.entries(record)) {
    const trimmedKey = String(key).trim();
    normalized[trimmedKey] = value;
  }
  
  return normalized;
}

/* =====================
   VALIDATION
===================== */

/**
 * Validates a person record: requires both first and last names.
 */
function isValidPerson(person) {
  if (!person || typeof person !== 'object') {
    return false;
  }

  const firstName = (person['First Name'] || '').trim();
  const lastName = (person['Last Name'] || '').trim();

  return firstName.length > 0 && lastName.length > 0;
}

/**
 * Checks if a person is actively searching (Open to Work field).
 * Blank, "Yes", "True", or "Open to Work" (case-insensitive) count as active.
 */
function isOpenToWork(person) {
  const value = (person['Open to Work'] || '').trim().toLowerCase();
  
  return value === '' || value === 'yes' || value === 'true' || value === 'open to work';
}

/* =====================
   METRIC CALCULATIONS
===================== */

/**
 * Calculates metrics from people.json and placed.json.
 * Returns object with all metrics or null for 24-hour results if no valid dates.
 */
function calculateMetrics(peopleList, placedList) {
  // Count Open to Work (valid people.json records that are actively searching)
  let openToWorkCount = 0;

  for (const rawPerson of peopleList) {
    const person = normalizePropertyNames(rawPerson);

    if (isValidPerson(person) && isOpenToWork(person)) {
      openToWorkCount++;
    }
  }

  // Count Placed (all valid placed.json records)
  let placedCount = 0;

  for (const rawPerson of placedList) {
    const person = normalizePropertyNames(rawPerson);

    if (isValidPerson(person)) {
      placedCount++;
    }
  }

  // Total People Supported
  const totalPeopleTracked = openToWorkCount + placedCount;

  // Last 24 Hours - Added to network
  let last24HoursAddedCount = 0;
  let hasValidAddedDate = false;

  for (const rawPerson of peopleList) {
    const person = normalizePropertyNames(rawPerson);

    if (!isValidPerson(person)) {
      continue;
    }

    // Try Date Added first, then Timestamp
    let dateAdded = parseDate(person['Date Added']);
    if (!dateAdded) {
      dateAdded = parseDate(person['Timestamp']);
    }

    if (dateAdded) {
      hasValidAddedDate = true;

      if (isWithinLast24Hours(dateAdded)) {
        last24HoursAddedCount++;
      }
    }
  }

  const last24HoursAddedResult = hasValidAddedDate ? last24HoursAddedCount : null;

  // Last 24 Hours - Placed
  let last24HoursPlacedCount = 0;
  let hasValidPlacedDate = false;

  for (const rawPerson of placedList) {
    const person = normalizePropertyNames(rawPerson);

    if (!isValidPerson(person)) {
      continue;
    }

    const datePlaced = parseDate(person['Date Placed']);

    if (datePlaced) {
      hasValidPlacedDate = true;

      if (isWithinLast24Hours(datePlaced)) {
        last24HoursPlacedCount++;
      }
    }
  }

  const last24HoursPlacedResult = hasValidPlacedDate ? last24HoursPlacedCount : null;

  return {
    openToWork: openToWorkCount,
    placed: placedCount,
    peopleTracked: totalPeopleTracked,
    last24HoursAdded: last24HoursAddedResult,
    last24HoursPlaced: last24HoursPlacedResult
  };
}

/* =====================
   RENDERING
===================== */

/**
 * Formats a metric number or returns em dash.
 */
function formatMetricNumber(value) {
  return value === null ? '—' : String(value);
}

/**
 * Formats a 24-hour activity value with plus sign or em dash.
 */
function formatActivityValue(value) {
  if (value === null) {
    return '—';
  }
  return `+${value}`;
}

/**
 * Renders the Talent Network Impact widget.
 */
function renderTalentImpactWidget(metrics) {
  const container = document.getElementById('talent-impact-widget');
  
  if (!container) {
    console.warn('talent-impact-widget container not found');
    return;
  }

  const openToWorkValue = formatMetricNumber(metrics.openToWork);
  const placedValue = formatMetricNumber(metrics.placed);
  const peopleTrackedValue = formatMetricNumber(metrics.peopleTracked);
  const last24HoursPlacedValue = formatActivityValue(metrics.last24HoursPlaced);
  const last24HoursAddedValue = formatActivityValue(metrics.last24HoursAdded);

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
          <div class="impact-number">${peopleTrackedValue}</div>
          <div class="impact-label">People Tracked</div>
        </div>
      </div>

      <div class="impact-activity-strip">
        <div class="activity-title">Last 24 Hours</div>
        <dl class="activity-items">
          <dt class="activity-label">Placements</dt>
          <dd class="activity-value">${last24HoursPlacedValue}</dd>
          
          <dt class="activity-label">New Members</dt>
          <dd class="activity-value">${last24HoursAddedValue}</dd>
        </dl>
      </div>

      <p class="impact-footer">
        Updated automatically from the Ex-Grubhub Talent Network tracker.
      </p>
    </div>
  `;

  // Update aria-busy
  container.setAttribute('aria-busy', 'false');
}

/**
 * Renders loading state.
 */
function renderTalentImpactLoading(container) {
  if (!container) {
    return;
  }

  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `
    <div class="talent-impact-container">
      <p class="impact-loading">Loading Talent Network Impact...</p>
    </div>
  `;
}

/**
 * Renders error state.
 */
function renderTalentImpactError(container, message) {
  if (!container) {
    return;
  }

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

/**
 * Loads people.json with cache busting.
 */
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

/**
 * Loads placed.json with cache busting.
 */
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

/**
 * Initializes the Talent Impact widget.
 */
async function initTalentImpactWidget() {
  const container = document.getElementById('talent-impact-widget');
  
  if (!container) {
    console.warn('talent-impact-widget container not found');
    return;
  }

  // Show loading state
  renderTalentImpactLoading(container);

  try {
    // Load both data files
    const [peopleList, placedList] = await Promise.all([
      loadPeopleData(),
      loadPlacedData()
    ]);

    // Calculate metrics
    const metrics = calculateMetrics(peopleList, placedList);

    // Render widget
    renderTalentImpactWidget(metrics);
  } catch (error) {
    console.error('Error loading Talent Network Impact:', error);
    renderTalentImpactError(container, error.message);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTalentImpactWidget);
} else {
  initTalentImpactWidget();
}
