import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
import {
  getFitTone,
  getSummaryStats,
  sortAndFilterMatches,
} from "./placement-utils.js";

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

let latestPayload = null;
let activeSort = "score_desc";
let activeFilter = "all";

function setStatus(element, message, kind = "") {
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

function showSession(session) {
  const signedIn = Boolean(session?.user);
  authPanel.hidden = signedIn;
  workspace.hidden = !signedIn;
  sessionEmail.textContent = session?.user?.email ?? "";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(authStatus, "Sending secure link…");
  const email = new FormData(loginForm).get("email");
  const redirectTo = new URL("placement.html", window.location.href).href;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) setStatus(authStatus, error.message, "error");
  else setStatus(authStatus, "Check your email and open the sign-in link on this device.", "success");
});

signOutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  resultsSection.hidden = true;
});

supabase.auth.onAuthStateChange((_event, session) => showSession(session));
const { data: { session } } = await supabase.auth.getSession();
showSession(session);

function renderList(items, emptyState = "None identified") {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(emptyState)}</p>`;
}

function toCsvValue(value) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
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

function renderMatches(data) {
  const role = data.evaluation.role;
  const source = data.evaluation.sourceUrl
    ? `<a class="summary-pill summary-link" href="${escapeHtml(data.evaluation.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source job ↗</a>`
    : `<span class="summary-pill">Pasted description</span>`;
  const summaryStats = getSummaryStats(data.matches ?? []);
  evaluationSummary.innerHTML = [
    `<span class="summary-pill"><strong>${escapeHtml(role?.roleFamily ?? "Unclassified")}</strong> role family</span>`,
    `<span class="summary-pill"><strong>${escapeHtml(data.evaluation.seniority ?? "Not detected")}</strong> seniority</span>`,
    `<span class="summary-pill"><strong>${data.evaluation.candidateCount}</strong> opted-in candidates</span>`,
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

  const visibleMatches = sortAndFilterMatches(data.matches ?? [], activeSort, activeFilter);
  results.innerHTML = visibleMatches.map((match, index) => {
    const fitTone = getFitTone(match);
    const breakdown = Object.entries(match.breakdown ?? {}).map(([key, value]) => `
      <div class="evidence-item ${value.score === 0 ? "is-zero" : ""}">
        <span>${escapeHtml(labels[key] ?? key)} <em>${value.max}pts</em></span>
        <strong>${value.score}/${value.max}</strong>
        <div class="score-bar"><i style="width:${Math.max(0, Math.min(100, (value.score / (value.max || 1)) * 100))}%"></i></div>
      </div>
    `).join("");
    const linkedin = match.candidate.linkedinUrl
      ? `<a class="candidate-link" href="${escapeHtml(match.candidate.linkedinUrl)}" target="_blank" rel="noopener noreferrer">Review LinkedIn →</a>`
      : "";
    return `
      <article class="match-card fit-${fitTone}" style="--stagger-delay:${index * 60}ms">
        <div class="score-column">
          <div class="score-ring" style="--score:${match.score}"><strong>${match.score}</strong></div>
          <span class="fit-band fit-${fitTone}">${escapeHtml(match.fitBand)}</span>
        </div>
        <div class="match-main">
          <h3>${escapeHtml(match.candidate.name)}</h3>
          <p class="candidate-meta">${escapeHtml(match.candidate.formerJobTitle ?? "Role not recorded")} · ${escapeHtml(match.candidate.location ?? "Location not recorded")}</p>
          <div class="evidence-grid">${breakdown}</div>
          <div class="reason-columns">
            <div class="reason-panel evidence-panel"><h4><span aria-hidden="true">✓</span> Evidence for match</h4>${renderList(match.reasons)}</div>
            <div class="reason-panel gap-panel"><h4><span aria-hidden="true">⚠</span> Review gaps</h4>${renderList(match.gaps, "No immediate gaps identified")}</div>
          </div>
          ${linkedin}
        </div>
      </article>`;
  }).join("");

  const exportButton = document.querySelector("#exportResults");
  if (exportButton) {
    exportButton.addEventListener("click", () => downloadCsv(visibleMatches));
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

  filterAll.classList.toggle("is-active", activeFilter === "all");
  filterStrong.classList.toggle("is-active", activeFilter === "strong");
  filterAll.setAttribute("aria-pressed", String(activeFilter === "all"));
  filterStrong.setAttribute("aria-pressed", String(activeFilter === "strong"));
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

sortResults.addEventListener("change", () => {
  activeSort = sortResults.value;
  if (latestPayload) renderMatches(latestPayload);
});

filterAll.addEventListener("click", () => {
  activeFilter = "all";
  if (latestPayload) renderMatches(latestPayload);
});

filterStrong.addEventListener("click", () => {
  activeFilter = "strong";
  if (latestPayload) renderMatches(latestPayload);
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
  const { data, error } = await supabase.functions.invoke("evaluate-job", { body: payload });

  evaluateButton.disabled = false;
  if (error) {
    let message = error.message;
    try {
      const response = error.context;
      const body = response ? await response.json() : null;
      if (body?.error) message = body.error;
    } catch (_) { /* Keep the SDK error message. */ }
    setStatus(evaluationStatus, message, "error");
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
  renderMatches(data);
});
