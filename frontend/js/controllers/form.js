import { $, notify } from "../ui/shared.js";
import { validDate } from "../domain/validation.js";
import { appState } from "../core/state.js";
import { buildNextTransactions } from "../domain/transactions.js";
import { commit } from "../services/persistence.js";
import { materializeRecurring } from "../services/recurrence.js";
import { updateFilters } from "../ui/navigation.js";
import { render } from "../ui/overview.js";
import {
  newInstallment,
  openForm,
  setType,
  updateCategoryHint,
  updateSchedule,
} from "../ui/forms.js";

export function bindForm() {
  $("#transactionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const description = $("#description").value.trim();
    const amount = Number($("#amount").value);
    const date = $("#date").value;
    if (
      !description ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999 ||
      !validDate(date)
    ) {
      $("#formError").textContent =
        "Preencha a descrição, uma data válida e um valor maior que zero.";
      return;
    }
    const old = appState.transactions.find(
      (item) => item.id === appState.editingId,
    );
    const schedule =
      appState.formType === "income" ? "once" : $("#schedule").value;
    const count = Number($("#installments").value);
    const totalCents = Math.round(amount * 100);
    if (
      !old &&
      schedule === "installments" &&
      (!Number.isInteger(count) ||
        count < 2 ||
        count > 360 ||
        totalCents < count)
    ) {
      $("#formError").textContent =
        "Escolha de 2 a 360 parcelas. Cada parcela precisa valer pelo menos R$ 0,01.";
      return;
    }
    const updated = {
      ...old,
      id: old?.id ?? crypto.randomUUID(),
      description,
      amount: totalCents / 100,
      type:
        schedule === "fixed"
          ? old?.type === "subscription"
            ? "subscription"
            : "fixed"
          : appState.formType,
      category: $("#category").value.trim(),
      rawDate: date,
      monthKey: date.slice(0, 7),
      date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR"),
      timestamp: old?.timestamp ?? Date.now(),
      paid: appState.formType === "income" || $("#paid").checked,
      recurring: schedule === "fixed",
    };
    if (!old && schedule === "fixed") {
      updated.recurringAnchorDate = date;
      updated.recurringTemplate = {
        description: updated.description,
        amount: updated.amount,
        category: updated.category,
      };
    }
    if (old?.recurring && !old.recurringTemplate) {
      updated.recurringAnchorDate = old.recurringAnchorDate || old.rawDate;
      updated.recurringTemplate = {
        description: old.description,
        amount: old.amount,
        category: old.category,
      };
    }
    const next = buildNextTransactions(appState.transactions, updated, {
      old,
      schedule,
      count,
    });
    if (!(await commit(next))) {
      $("#formError").textContent =
        "O lançamento não foi salvo. Confira a mensagem abaixo.";
      return;
    }
    appState.selectedMonth = new Date(`${date.slice(0, 7)}-01T12:00:00`);
    await materializeRecurring();
    appState.filter = "all";
    $("#searchInput").value = "";
    updateFilters();
    render();
    $("#transactionDialog").close();
    if (!old && schedule === "installments") location.hash = "parcelas";
    notify(
      old
        ? "Lançamento atualizado."
        : "Lançamento salvo. Um a menos para lembrar.",
    );
  });
  document
    .querySelectorAll("[data-type]")
    .forEach((button) =>
      button.addEventListener("click", () => setType(button.dataset.type)),
    );
  $("#addButton").addEventListener("click", () => openForm());
  $("#emptyAdd").addEventListener("click", () => openForm());
  $("#schedule").addEventListener("change", () => {
    if ($("#schedule").value !== "once") $("#paid").checked = false;
    updateSchedule();
  });
  $("#installments").addEventListener("input", updateSchedule);
  $("#amount").addEventListener("input", updateSchedule);
  $("#category").addEventListener("input", updateCategoryHint);
  $("#addInstallmentButton").addEventListener("click", newInstallment);
  $("#emptyInstallmentAdd").addEventListener("click", newInstallment);
}
