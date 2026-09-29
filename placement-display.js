// Presentation layer for Placement Intelligence.
// Numeric scoring remains internal for ranking; the UI presents qualitative,
// evidence-based signals and an expandable analysis for human review.

const SIGNAL_LABELS = {
  Role: "Role",
  Title: "Title",
  Skills: "Skills",
  Domain: "Domain",
  Level: "Level",
  Location: "Location",
};

function qualitativeSignal(label, score, max) {
  const ratio = max > 0 ? score / max : 0;
  if (label === "Location") {
    if (ratio >= 0.8) return { text: "Match", tone: "strong" };
    if (ratio >= 0.4) return { text: "Partial", tone: "moderate" };
    return { text: "Review", tone: "limited" };
  }
  if (ratio >= 0.8) return { text: "Strong", tone: "strong" };
  if (ratio >= 0.55) return { text: "Moderate", tone: "moderate" };
  if (ratio > 0) return { text: "Limited", tone: "limited" };
  return { text: "Not evidenced", tone: "unknown" };
}

function transformEvidenceItem(item) {
  if (item.dataset.qualitative === "true") return;
  const labelNode = item.querySelector("span");
  const scoreNode = item.querySelector("strong");
  if (!labelNode || !scoreNode) return;
  const rawLabel = labelNode.childNodes[0]?.textContent?.trim() || labelNode.textContent.trim();
  const label = SIGNAL_LABELS[rawLabel] || rawLabel;
  const scoreMatch = scoreNode.textContent.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!scoreMatch) return;
  const signal = qualitativeSignal(label, Number(scoreMatch[1]), Number(scoreMatch[2]));
  item.classList.add("qualitative-signal", `signal-${signal.tone}`);
  item.classList.remove("is-zero");
  item.innerHTML = `<span class="signal-label">${label}</span><strong class="signal-value">${signal.text}</strong>`;
  item.dataset.qualitative = "true";
}

function transformScoreColumn(column) {
  if (column.dataset.qualitative === "true") return;
  const ring = column.querySelector(".score-ring");
  const band = column.querySelector(".fit-band");
  if (!ring || !band) return;
  const internalScore = ring.querySelector("strong")?.textContent?.trim() || "";
  ring.classList.add("internal-score");
  ring.setAttribute("aria-hidden", "true");
  ring.dataset.internalScore = internalScore;
  band.classList.add("primary-fit-band");
  column.dataset.qualitative = "true";
}

function cleanSummary(summary) {
  summary.querySelectorAll(".summary-pill").forEach((pill) => {
    const text = pill.textContent.trim().toLowerCase();
    if (text.includes("average score") || text.includes("category weights:")) pill.remove();
  });
}

function addExplanation(card) {
  if (card.querySelector(".score-explainer")) return;
  const grid = card.querySelector(".evidence-grid");
  if (!grid) return;
  const explainer = document.createElement("p");
  explainer.className = "score-explainer";
  explainer.textContent = "Signals summarize the strength of recorded evidence. Missing evidence is not treated as proof that a candidate lacks the experience.";
  grid.insertAdjacentElement("afterend", explainer);
}

function classifyReason(text) {
  const value = text.toLowerCase();
  if (value.includes("location")) return "Location";
  if (value.includes("seniority") || value.includes("level")) return "Level";
  if (value.includes("domain")) return "Domain";
  if (value.includes("title")) return "Title";
  if (value.includes("skill")) return "Skills";
  return "Role";
}

function buildRequirementRows(card) {
  const rows = [];
  card.querySelectorAll(".evidence-panel li").forEach((li) => {
    rows.push({ requirement: classifyReason(li.textContent), evidence: li.textContent.trim(), status: "Demonstrated", tone: "strong" });
  });
  card.querySelectorAll(".gap-panel li").forEach((li) => {
    const evidence = li.textContent.trim();
    const explicitGap = /required|requires|must have|does not|lacks|conflict/i.test(evidence);
    rows.push({ requirement: classifyReason(evidence), evidence, status: explicitGap ? "Gap / review" : "Needs validation", tone: explicitGap ? "gap" : "unknown" });
  });
  return rows;
}

function addDetailedAnalysis(card, index) {
  if (card.querySelector(".analysis-toggle")) return;
  const main = card.querySelector(".match-main");
  const reasonColumns = card.querySelector(".reason-columns");
  if (!main || !reasonColumns) return;

  const rows = buildRequirementRows(card);
  const demonstrated = rows.filter((row) => row.status === "Demonstrated").length;
  const unknown = rows.filter((row) => row.status === "Needs validation").length;
  const gaps = rows.filter((row) => row.status === "Gap / review").length;
  const signals = [...card.querySelectorAll(".qualitative-signal")].map((item) => ({
    label: item.querySelector(".signal-label")?.textContent || "Signal",
    value: item.querySelector(".signal-value")?.textContent || "Review",
  }));
  const strongest = signals.filter((s) => s.value === "Strong" || s.value === "Match").map((s) => s.label);
  const weakest = signals.filter((s) => ["Limited", "Not evidenced", "Review"].includes(s.value)).map((s) => s.label);
  const panelId = `candidate-analysis-${index}`;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "analysis-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panelId);
  toggle.innerHTML = `<span>View detailed analysis</span><span class="analysis-chevron" aria-hidden="true">⌄</span>`;

  const panel = document.createElement("section");
  panel.id = panelId;
  panel.className = "candidate-analysis";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="analysis-summary-grid">
      <div><strong>${demonstrated}</strong><span>Demonstrated</span></div>
      <div><strong>${unknown}</strong><span>Needs validation</span></div>
      <div><strong>${gaps}</strong><span>Gap / review</span></div>
    </div>
    <div class="analysis-section">
      <h4>Why this candidate surfaced</h4>
      <p>${strongest.length ? `Strongest recorded signals: ${strongest.join(", ")}.` : "No category currently has strong recorded evidence."} ${weakest.length ? `The areas needing the most scrutiny are ${weakest.join(", ")}.` : "No major category-level weakness is currently visible."}</p>
    </div>
    <div class="analysis-section">
      <h4>Evidence review</h4>
      <div class="requirement-table" role="table" aria-label="Candidate evidence review">
        ${rows.length ? rows.map((row) => `
          <div class="requirement-row" role="row">
            <span class="requirement-name" role="cell">${row.requirement}</span>
            <span class="requirement-evidence" role="cell">${row.evidence}</span>
            <span class="requirement-status status-${row.tone}" role="cell">${row.status}</span>
          </div>`).join("") : `<p>No detailed evidence was returned for this candidate.</p>`}
      </div>
    </div>
    <div class="analysis-section analysis-guidance">
      <h4>How to use this result</h4>
      <p><strong>Position around:</strong> ${strongest.length ? strongest.join(", ") : "the candidate's directly demonstrated experience"}.</p>
      <p><strong>Validate before treating as a strong match:</strong> ${weakest.length ? weakest.join(", ") : "no major category-level issue identified"}.</p>
      <p class="analysis-note">This analysis distinguishes recorded evidence from unknowns. “Needs validation” means the current candidate record does not prove the requirement either way.</p>
    </div>`;

  reasonColumns.insertAdjacentElement("afterend", toggle);
  toggle.insertAdjacentElement("afterend", panel);
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.querySelector("span:first-child").textContent = expanded ? "View detailed analysis" : "Hide detailed analysis";
    panel.hidden = expanded;
  });
}

function transformPlacementDisplay(root = document) {
  root.querySelectorAll(".evidence-item").forEach(transformEvidenceItem);
  root.querySelectorAll(".score-column").forEach(transformScoreColumn);
  root.querySelectorAll(".match-card:not(.skeleton-card)").forEach((card, index) => {
    addExplanation(card);
    addDetailedAnalysis(card, index);
  });
  root.querySelectorAll(".evaluation-summary").forEach(cleanSummary);
}

const observer = new MutationObserver(() => transformPlacementDisplay());
observer.observe(document.documentElement, { childList: true, subtree: true });
transformPlacementDisplay();
