export function getFitTone(match) {
  const score = Number(match?.score ?? 0);
  const fitBand = String(match?.fitBand ?? "").toLowerCase();
  if (score >= 80 || fitBand.includes("strong")) return "strong";
  if (score >= 60 || fitBand.includes("moderate")) return "moderate";
  return "review";
}

export function sortAndFilterMatches(matches = [], sortMode = "score_desc", filterMode = "all") {
  const filtered = matches.filter((match) => filterMode !== "strong" || getFitTone(match) === "strong");
  const sorted = [...filtered];
  if (sortMode === "score_asc") {
    sorted.sort((a, b) => Number(a?.score ?? 0) - Number(b?.score ?? 0));
  } else if (sortMode === "name_asc") {
    sorted.sort((a, b) => String(a?.candidate?.name ?? "").localeCompare(String(b?.candidate?.name ?? ""), undefined, { sensitivity: "base" }));
  } else {
    sorted.sort((a, b) => Number(b?.score ?? 0) - Number(a?.score ?? 0));
  }
  return sorted;
}

export function getSummaryStats(matches = []) {
  const totals = matches.reduce((acc, match) => {
    acc.total += 1;
    acc.scoreTotal += Number(match?.score ?? 0);
    acc[getFitTone(match)] += 1;
    return acc;
  }, { total: 0, scoreTotal: 0, strong: 0, moderate: 0, review: 0 });

  return {
    ...totals,
    averageScore: totals.total ? Math.round(totals.scoreTotal / totals.total) : 0,
  };
}
