import { appState } from "../core/state.js";
import { $ } from "./shared.js";

export function updateFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.filter === appState.filter,
    );
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === appState.filter),
    );
  });
}

export function showPage() {
  const isInstallments = location.hash === "#parcelas";
  $("#overview").hidden = isInstallments;
  $("#installmentsPage").hidden = !isInstallments;
  document.querySelectorAll(".nav-item").forEach((link) => {
    const active =
      link.hash ===
      (isInstallments
        ? "#parcelas"
        : location.hash === "#transactions"
          ? "#transactions"
          : "#overview");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (isInstallments) window.scrollTo(0, 0);
}
