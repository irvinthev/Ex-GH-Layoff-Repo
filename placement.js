import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";

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

function renderList(items) {
  return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>None identified</p>";
}

function renderMatches(data) {
  const role = data.evaluation.role;
  evaluationSummary.innerHTML = [
    `<span class="summary-pill"><strong>${escapeHtml(role?.roleFamily ?? "Unclassified")}</strong> role family</span>`,
    `<span class="summary-pill"><strong>${escapeHtml(data.evaluation.seniority ?? "Not detected")}</strong> seniority</span>`,
    `<span class="summary-pill"><strong>${data.evaluation.candidateCount}</strong> opted-in candidates</span>`,
    `<span class="summary-pill">Manual review required</span>`,
  ].join("");

  const labels = {
    roleFamily: "Role",
    titleSpecialty: "Title",
    skills: "Skills",
    domain: "Domain",
    seniority: "Level",
    location: "Location",
  };

  results.innerHTML = data.matches.map((match) => {
    const breakdown = Object.entries(match.breakdown).map(([key, value]) => `
      <div class="evidence-item"><span>${labels[key]}</span><strong>${value.score}/${value.max}</strong></div>
    `).join("");
    const linkedin = match.candidate.linkedinUrl
      ? `<a class="candidate-link" href="${escapeHtml(match.candidate.linkedinUrl)}" target="_blank" rel="noopener noreferrer">Review LinkedIn →</a>`
      : "";
    return `
      <article class="match-card">
        <div class="score-column">
          <div class="score-ring" style="--score:${match.score}"><strong>${match.score}</strong></div>
          <span class="fit-band">${escapeHtml(match.fitBand)}</span>
        </div>
        <div class="match-main">
          <h3>${escapeHtml(match.candidate.name)}</h3>
          <p class="candidate-meta">${escapeHtml(match.candidate.formerJobTitle ?? "Role not recorded")} · ${escapeHtml(match.candidate.location ?? "Location not recorded")}</p>
          <div class="evidence-grid">${breakdown}</div>
          <div class="reason-columns">
            <div><h4>Evidence for match</h4>${renderList(match.reasons)}</div>
            <div><h4>Review gaps</h4>${renderList(match.gaps)}</div>
          </div>
          ${linkedin}
        </div>
      </article>`;
  }).join("");
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

evaluationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  evaluateButton.disabled = true;
  setStatus(evaluationStatus, "Evaluating opted-in candidates…");
  resultsSection.hidden = true;

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
    return;
  }
  setStatus(evaluationStatus, "Evaluation complete.", "success");
  renderMatches(data);
});
