export function applyFilterButtonState(filterAllButton, filterStrongButton, activeFilter) {
  const allActive = activeFilter === "all";
  filterAllButton.classList.toggle("is-active", allActive);
  filterStrongButton.classList.toggle("is-active", !allActive);
  filterAllButton.setAttribute("aria-pressed", String(allActive));
  filterStrongButton.setAttribute("aria-pressed", String(!allActive));
}

export function wireResultControls({
  sortSelect,
  filterAllButton,
  filterStrongButton,
  onChange,
}) {
  applyFilterButtonState(filterAllButton, filterStrongButton, "all");

  sortSelect.addEventListener("change", () => {
    onChange({
      sort: sortSelect.value,
      filter: filterAllButton.getAttribute("aria-pressed") === "true" ? "all" : "strong",
    });
  });

  filterAllButton.addEventListener("click", () => {
    applyFilterButtonState(filterAllButton, filterStrongButton, "all");
    onChange({
      sort: sortSelect.value,
      filter: "all",
    });
  });

  filterStrongButton.addEventListener("click", () => {
    applyFilterButtonState(filterAllButton, filterStrongButton, "strong");
    onChange({
      sort: sortSelect.value,
      filter: "strong",
    });
  });
}
