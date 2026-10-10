import { appState } from "../core/state.js";
import { materializeRecurring } from "../services/recurrence.js";
import { render } from "../ui/overview.js";
import { showPage, updateFilters } from "../ui/navigation.js";
import { $ } from "../ui/shared.js";

export async function changeMonth(delta) {
  appState.selectedMonth = new Date(
    appState.selectedMonth.getFullYear(),
    appState.selectedMonth.getMonth() + delta,
    1,
  );
  await materializeRecurring();
  render();
}

export function bindNavigation() {
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      appState.filter = button.dataset.filter;
      updateFilters();
      render();
    }),
  );
  $("#searchInput").addEventListener("input", render);
  $("#previousMonth").addEventListener("click", () => changeMonth(-1));
  $("#nextMonth").addEventListener("click", () => changeMonth(1));
  $("#todayButton").addEventListener("click", async () => {
    appState.selectedMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    await materializeRecurring();
    render();
  });
  window.addEventListener("hashchange", showPage);
}
