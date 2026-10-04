import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
import {
  getFitTone,
  getSummaryStats,
  sortAndFilterMatches,
} from "./placement-utils.js?v=scoring-4";
import { applyFilterButtonState, wireResultControls } from "./placement-controls.js";

const SUPABASE_URL = "https://ulzlkewtarzajseepbvj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hkRBpDIfH3_GFDUDJtygoQ_ItfkONsi";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authPanel = document.querySelector("#authPanel");
const workspace = document.querySelector("#workspace");
const loginForm = document.querySelector("#loginForm");
const authStatus = document.querySelector("#authStatus");
const sessionEmail = document.querySelector("#sessionEmail");
const signOutButton = document.querySelector("#signOut");
const evaluationForm = document.querySelector("#evaluationForm");
const evaluateButton = document.querySelector("#evaluateButton");
const evaluationStatus = document.querySelector("#evaluationStatus");
const resultsSection = document.querySelector("#resultsSection");
const evaluationSummary = document.querySelector("#evaluationSummary");
const results = document.querySelector("#results");
const jobUrlInput = document.querySelector("#jobUrl");
const jobDescription = document.querySelector("#jobDescription");
const sortResults = document.querySelector("#sortResults");
const filterAll = document.querySelector("#filterAll");
const filterStrong = document.querySelector("#filterStrong");
const historyList = document.querySelector("#historyList");
const historyStatus = document.querySelector("#historyStatus");
const refreshHistoryButton = document.querySelector("#refreshHistory");
const networkReviewButton = document.querySelector("#networkReviewButton");
const networkReviewCount = document.querySelector("#networkReviewCount");
const networkReviewPanel = document.querySelector("#networkReviewPanel");
const networkReviewStatus = document.querySelector("#networkReviewStatus");
const networkReviewSummary = document.querySelector("#networkReviewSummary");
const networkReviewList = document.querySelector("#networkReviewList");
const refreshNetworkReviewButton = document.querySelector("#refreshNetworkReview");

const BETA_SESSION_KEY = "placement_beta_session";
let latestPayload = null;
let activeSort = "score_desc";
let activeFilter = "all";
let showAllMatches = false;
const DEFAULT_RESULT_LIMIT = 5;

function setStatus(element, message, kind = "") {
  if (!element) return;
  element.textContent = message;
  element.className = `status-message ${kind}`.trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getBetaSession() {
  try {
    const raw = sessionStorage.getItem(BETA_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token || !session?.email || !session?.expiresAt) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(BETA_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(BETA_SESSION_KEY);
    return null;
  }
}

function showSession(session = getBetaSession()) {
  const signedIn = Boolean(session?.token);
  authPanel.hidden = signedIn;
  workspace.hidden = !signedIn;
  sessionEmail.textContent = session?.email ?? "";
  if (signedIn) {
    loadHistory().catch(() => {
      setStatus(historyStatus, "Recent evaluations could not be loaded.", "warning");
    });
    loadNetworkReview({ quiet: true }).catch(() => {
      // Keep Placement Engineer usable if the admin hygiene check cannot load.
    });
  }
}

async function invokePlacement(body) {
  const session = getBetaSession();
  if (!session) {
    showSession(null);
    throw new Error("Beta session expired. Sign in again.");
  }
  return supabase.functions.invoke("evaluate-job", {
    body,
    headers: { "x-beta-token": session.token },
  });
}

function formatRunDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function renderHistory(runs) {
  if (!runs.length) {
    historyList.innerHTML = '<p class="history-empty">No saved evaluations yet. Your next job run will appear here automatically.</p>';
    return;
  }
  historyList.innerHTML = runs.map((run) => {
    const role = run.role_snapshot?.roleFamily ?? "Unclassified";
    const source = run.source_url
      ? '<span class="history-source">URL</span>'
      : '<span class="history-source">Pasted</span>';
    return `
      <button class="history-row" type="button" data-run-id="${escapeHtml(run.id)}">
        <span class="history-main">
          <strong>${escapeHtml(run.title)}</strong>
          <small>${escapeHtml(role)} · ${escapeHtml(run.seniority ?? "Level not detected")} · ${escapeHtml(run.location_text ?? "Location not recorded")}</small>
        </span>
        <span class="history-meta">
          ${source}
          <small>${escapeHtml(formatRunDate(run.created_at))}</small>
        </span>
      </button>
    `;
  }).join("");

  historyList.querySelectorAll("[data-run-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const runId = button.getAttribute("data-run-id");
      if (!runId) return;
      setStatus(historyStatus, "Loading saved evaluation…");
      const { data, error } = await invokePlacement({ action: "history_detail", runId });
      if (error) {
        setStatus(historyStatus, error.message, "error");
        return;
      }
      latestPayload = data;
      showAllMatches = false;
      setStatus(historyStatus, `Loaded ${data.evaluation?.title ?? "saved evaluation"} from ${formatRunDate(data.createdAt)}.`, "success");
      renderMatches(data);
    });
  });
}

async function loadHistory() {
  if (!historyList || !historyStatus) return;
  setStatus(historyStatus, "Loading recent evaluations…");
  const { data, error } = await invokePlacement({ action: "history" });
  if (error) {
    setStatus(historyStatus, error.message, "error");
    return;
  }
  renderHistory(data?.runs ?? []);
  setStatus(historyStatus, "");
}

refreshHistoryButton?.addEventListener("click", loadHistory);

function renderNetworkReview(data) {
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  if (networkReviewCount) {
    networkReviewCount.textContent = String(issues.length);
    networkReviewCount.hidden = issues.length === 0;
  }
  if (networkReviewSummary) {
    const high = issues.filter((issue) => issue.severity === "high").length;
    const medium = issues.filter((issue) => issue.severity === "medium").length;
    const low = issues.filter((issue) => issue.severity === "low").length;
    networkReviewSummary.innerHTML = `
      <span><strong>${issues.length}</strong> open</span>
      <span><strong>${high}</strong> high</span>
      <span><strong>${medium}</strong> medium</span>
      <span><strong>${low}</strong> low</span>
      <span><strong>${data?.directoryCount ?? 0}</strong> directory</span>
      <span><strong>${data?.enrichedCount ?? 0}</strong> enriched</span>
    `;
  }
  if (!networkReviewList) return;
  if (!issues.length) {
    networkReviewList.innerHTML = '<p class="history-empty">No network review items right now.</p>';
    return;
  }
  networkReviewList.innerHTML = issues.map((issue) => `
    <article class="network-review-item severity-${escapeHtml(issue.severity)}">
      <div class="network-review-item-top">
        <strong>${escapeHtml(issue.candidateName)}</strong>
        <span class="review-severity">${escapeHtml(issue.severity)}</span>
      </div>
      <p>${escapeHtml(issue.message)}</p>
      <small>${escapeHtml(issue.suggestedAction)}</small>
    </article>
  `).join("");
}

async function loadNetworkReview({ quiet = false } = {}) {
  if (!networkReviewList) return;
  if (!quiet) setStatus(networkReviewStatus, "Checking directory identities…");
  const { data, error } = await invokePlacement({ action: "network_review" });
  if (error) {
    if (!quiet) setStatus(networkReviewStatus, error.message, "error");
    return;
  }
  renderNetworkReview(data);
  if (!quiet) setStatus(networkReviewStatus, "");
}

networkReviewButton?.addEventListener("click", () => {
  const opening = networkReviewPanel?.hidden !== false;
  if (networkReviewPanel) networkReviewPanel.hidden = !opening;
  networkReviewButton.setAttribute("aria-expanded", opening ? "true" : "false");
  if (opening) loadNetworkReview().catch(() => setStatus(networkReviewStatus, "Network Review could not be loaded.", "error"));
});

refreshNetworkReviewButton?.addEventListener("click", () => {
  loadNetworkReview().catch(() => setStatus(networkReviewStatus, "Network Review could not be loaded.", "error"));
});


loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(authStatus, "Checking beta access…");
  const form = new FormData(loginForm);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/beta-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(authStatus, payload?.error ?? "Beta sign-in failed.", "error");
    return;
  }
  sessionStorage.setItem(BETA_SESSION_KEY, JSON.stringify(payload));
  loginForm.reset();
  setStatus(authStatus, "");
  showSession(payload);
});

signOutButton.addEventListener("click", () => {
  sessionStorage.removeItem(BETA_SESSION_KEY);
  resultsSection.hidden = true;
  showSession(null);
});

showSession();

function renderList(items, emptyState = "None identified") {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(emptyState)}</p>`;
}

function toCsvValue(value) {
  return `"${String(value ?? "").replace(/[\r\n]+/g, " ").replace(/"/g, "\"\"")}"`;
}

function downloadCsv(data) {
  const rows = [
    ["Name", "Score", "Fit Band", "Former Title", "Location", "LinkedIn URL", "Reasons", "Gaps"],
    ...data.map((match) => [
      match.candidate?.name ?? "",
      match.score ?? "",
      match.fitBand ?? "",
      match.candidate?.formerJobTitle ?? "",
      match.candidate?.location ?? "",
      match.candidate?.linkedinUrl ?? "",
      (match.reasons ?? []).join(" | "),
      (match.gaps ?? []).join(" | "),
    ]),
  ];
  const csvContent = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "placement-results.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderLoadingState() {
  resultsSection.setAttribute("aria-busy", "true");
  evaluationSummary.innerHTML = `<span class="summary-pill"><strong>Evaluating candidates…</strong> Building ranked matches.</span>`;
  results.innerHTML = Array.from({ length: 3 }, () => `
    <article class="match-card skeleton-card" aria-hidden="true">
      <div class="score-column">
        <div class="skeleton-block skeleton-ring"></div>
        <div class="skeleton-block skeleton-badge"></div>
      </div>
      <div class="match-main">
        <div class="skeleton-block skeleton-title"></div>
        <div class="skeleton-block skeleton-meta"></div>
        <div class="skeleton-grid">
          ${Array.from({ length: 6 }, () => `<div class="skeleton-block skeleton-chip"></div>`).join("")}
        </div>
      </div>
    </article>
  `).join("");
  resultsSection.hidden = false;
}

function renderMatches(data, { scrollToResults = true } = {}) {
  resultsSection.setAttribute("aria-busy", "false");
  const role = data.evaluation.role;
  const source = data.evaluation.sourceUrl
    ? `<a class="summary-pill summary-link" href="${escapeHtml(data.evaluation.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source job ↗</a>`
    : `<span class="summary-pill">Pasted description</span>`;
  const summaryStats = getSummaryStats(data.matches ?? []);
  evaluationSummary.innerHTML = [
    `<span class="summary-pill"><strong>${escapeHtml(role?.roleFamily ?? "Unclassified")}</strong> role family</span>`,
    `<span class="summary-pill"><strong>${escapeHtml(data.evaluation.seniority ?? "Not detected")}</strong> seniority</span>`,
    `<span class="summary-pill"><strong>${data.evaluation.candidateCount}</strong> candidates evaluated</span>`,
    `<span class="summary-pill"><strong>${summaryStats.strong}</strong> Strong Fits | <strong>${summaryStats.moderate}</strong> Moderate | <strong>${summaryStats.review}</strong> Need Review</span>`,
    `<span class="summary-pill"><strong>${summaryStats.averageScore}</strong> average score</span>`,
    `<span class="summary-pill summary-legend" title="Role Family 30pts, Title/Specialty 15pts, Skills 20pts, Domain 15pts, Seniority 10pts, Location 10pts">Category weights: 30 / 15 / 20 / 15 / 10 / 10</span>`,
    `<span class="summary-pill">Manual review required</span>`,
    source,
    `<button id="exportResults" class="summary-action" type="button">Export Results</button>`,
    `<button id="evaluateAnother" class="summary-action" type="button">Evaluate Another</button>`,
  ].join("");

  const labels = {
    roleFamily: "Role",
    titleSpecialty: "Title",
    skills: "Skills",
    domain: "Domain",
    seniority: "Level",
    location: "Location",
  };

  const filteredMatches = sortAndFilterMatches(data.matches ?? [], activeSort, activeFilter);
  const visibleMatches = showAllMatches ? filteredMatches : filteredMatches.slice(0, DEFAULT_RESULT_LIMIT);
  const hiddenMatchCount = Math.max(0, filteredMatches.length - visibleMatches.length);
  if (filteredMatches.length > DEFAULT_RESULT_LIMIT) {
    evaluationSummary.insertAdjacentHTML("beforeend",
      `<button id="toggleAllMatches" class="summary-action result-count-action" type="button">${showAllMatches ? "Show Top 5" : `View All ${filteredMatches.length} Matches`}</button>`
    );
  }
  results.innerHTML = visibleMatches.map((match, index) => {
    const fitTone = getFitTone(match);
    const breakdown = Object.entries(match.breakdown ?? {}).map(([key, value]) => `
      <div class="evidence-item ${value.score === 0 ? "is-zero" : ""}">
        <span>${escapeHtml(labels[key] ?? key)} <em>${value.max}pts</em></span>
        <strong>${value.score}/${value.max}</strong>
        <div class="score-bar"><i style="width:${Math.max(0, Math.min(100, (value.score / (value.max || 1)) * 100))}%"></i></div>
      </div>
    `).join("");
    const linkedin = match.candidate?.linkedinUrl
      ? `<a class="candidate-link" href="${escapeHtml(match.candidate?.linkedinUrl)}" target="_blank" rel="noopener noreferrer">Review LinkedIn →</a>`
      : "";
    return `
      <article class="match-card fit-${fitTone}" style="--stagger-delay:${index * 60}ms">
        <div class="score-column">
          <div class="score-ring" style="--score:${match.score}"><strong>${match.score}</strong></div>
          <span class="fit-band fit-${fitTone}">${escapeHtml(match.fitBand)}</span>
        </div>
        <div class="match-main">
          <h3>${escapeHtml(match.candidate?.name ?? "Candidate name unavailable")}</h3>
          <p class="candidate-meta">${escapeHtml(match.candidate?.formerJobTitle ?? "Role not recorded")} · ${escapeHtml(match.candidate?.location ?? "Location not recorded")}</p>
          <div class="evidence-grid">${breakdown}</div>
          <div class="reason-columns">
            <div class="reason-panel evidence-panel"><h4><span aria-hidden="true">✓</span> Why this person surfaced</h4>${renderList(match.reasons)}</div>
            <div class="reason-panel gap-panel"><h4><span aria-hidden="true">⚠</span> Potential gaps</h4>${renderList(match.gaps, "No immediate gaps identified")}</div>
          </div>
          ${linkedin}
        </div>
      </article>`;
  }).join("");

  const toggleAllMatches = document.querySelector("#toggleAllMatches");
  if (toggleAllMatches) {
    toggleAllMatches.addEventListener("click", () => {
      showAllMatches = !showAllMatches;
      renderMatches(data, { scrollToResults: false });
    });
  }

  const exportButton = document.querySelector("#exportResults");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      const currentMatches = sortAndFilterMatches(data.matches ?? [], activeSort, activeFilter);
      downloadCsv(currentMatches);
    });
  }
  const evaluateAnotherButton = document.querySelector("#evaluateAnother");
  if (evaluateAnotherButton) {
    evaluateAnotherButton.addEventListener("click", () => {
      evaluationForm.scrollIntoView({ behavior: "smooth", block: "start" });
      jobUrlInput.focus();
    });
  }

  if (!visibleMatches.length) {
    results.innerHTML = `<p class="summary-pill">No matches met the selected filter. Try viewing all results.</p>`;
  }

  applyFilterButtonState(filterAll, filterStrong, activeFilter);
  resultsSection.hidden = false;
  if (scrollToResults) {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

wireResultControls({
  sortSelect: sortResults,
  filterAllButton: filterAll,
  filterStrongButton: filterStrong,
  onChange: ({ sort, filter }) => {
    activeSort = sort;
    activeFilter = filter;
    showAllMatches = false;
    if (latestPayload) renderMatches(latestPayload, { scrollToResults: false });
  },
});

evaluationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const jobUrl = jobUrlInput.value.trim();
  const description = jobDescription.value.trim();
  if (!jobUrl && description.length < 50) {
    setStatus(evaluationStatus, "Add a public job URL or paste at least 50 characters of the description.", "error");
    jobUrlInput.focus();
    return;
  }
  evaluateButton.disabled = true;
  setStatus(evaluationStatus, jobUrl ? "Reading the job page and evaluating candidates…" : "Evaluating opted-in candidates…");
  renderLoadingState();

  const form = new FormData(evaluationForm);
  const payload = Object.fromEntries(form.entries());
  const { data, error } = await invokePlacement(payload);

  evaluateButton.disabled = false;
  if (error) {
    let message = error.message;
    try {
      const response = error.context;
      const body = response ? await response.json() : null;
      if (body?.error) message = body.error;
    } catch (_) { /* Keep the SDK error message. */ }
    setStatus(evaluationStatus, message, "error");
    resultsSection.setAttribute("aria-busy", "false");
    resultsSection.hidden = true;
    return;
  }
  const completionMessage = data.evaluation.importWarning
    ? `Evaluation complete. ${data.evaluation.importWarning}`
    : data.evaluation.sourceMode === "structured"
      ? "Job page imported and evaluation complete."
      : "Evaluation complete.";
  setStatus(evaluationStatus, completionMessage, data.evaluation.importWarning ? "warning" : "success");
  latestPayload = data;
  showAllMatches = false;
  renderMatches(data);
  loadHistory().catch(() => {
    setStatus(historyStatus, "Evaluation saved, but recent history could not refresh.", "warning");
  });
});
