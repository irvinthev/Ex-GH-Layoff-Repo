// Presentation layer for Placement Intelligence.
// The deterministic score remains available to ranking/sorting internally,
// but the UI intentionally avoids presenting point allocations as precise
// qualification percentages.

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

  // Location is closer to a compatibility check than a strength continuum.
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

  const score = Number(scoreMatch[1]);
  const max = Number(scoreMatch[2]);
  const signal = qualitativeSignal(label, score, max);

  item.classList.add("qualitative-signal", `signal-${signal.tone}`);
  item.classList.remove("is-zero");
  item.innerHTML = `
    <span class="signal-label">${label}</span>
    <strong class="signal-value">${signal.text}</strong>
  `;
  item.dataset.qualitative = "true";
}

function transformScoreColumn(column) {
  if (column.dataset.qualitative === "true") return;
  const ring = column.querySelector(".score-ring");
  const band = column.querySelector(".fit-band");
  if (!ring || !band) return;

  // Keep the score in the DOM as non-visible metadata for debugging and
  // ranking traceability, but do not present it as a qualification percentage.
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
    if (text.includes("average score") || text.includes("category weights:")) {
      pill.remove();
    }
  });
}

function addExplanation(card) {
  if (card.querySelector(".score-explainer")) return;
  const main = card.querySelector(".match-main");
  const grid = card.querySelector(".evidence-grid");
  if (!main || !grid) return;

  const explainer = document.createElement("p");
  explainer.className = "score-explainer";
  explainer.textContent = "Signals summarize the strength of recorded evidence. Missing evidence is not treated as proof that a candidate lacks the experience.";
  grid.insertAdjacentElement("afterend", explainer);
}

function transformPlacementDisplay(root = document) {
  root.querySelectorAll(".evidence-item").forEach(transformEvidenceItem);
  root.querySelectorAll(".score-column").forEach(transformScoreColumn);
  root.querySelectorAll(".match-card:not(.skeleton-card)").forEach(addExplanation);
  root.querySelectorAll(".evaluation-summary").forEach(cleanSummary);
}

const observer = new MutationObserver(() => transformPlacementDisplay());
observer.observe(document.documentElement, { childList: true, subtree: true });
transformPlacementDisplay();
