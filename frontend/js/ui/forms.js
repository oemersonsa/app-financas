import { appState } from "../core/state.js";
import { $ } from "./shared.js";
import { localDate, monthKey } from "../core/dates.js";
import { isPaid } from "../domain/installments.js";
import { categoryHints } from "../domain/categories.js";
import { money } from "../core/format.js";

export function setType(type) {
  appState.formType = type;
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.type === type);
    button.setAttribute("aria-pressed", String(button.dataset.type === type));
  });
  $("#paidField").hidden = type === "income";
  $("#scheduleField").hidden = type === "income";
  if (type === "income") $("#schedule").value = "once";
  updateSchedule();
}

export function openForm(item = null) {
  appState.editingId = item?.id ?? null;
  $("#transactionForm").reset();
  $("#formError").textContent = "";
  $("#dialogTitle").textContent = item
    ? "Editar lançamento"
    : "Novo lançamento";
  $("#description").value = item?.description || "";
  $("#amount").value = item?.amount ?? "";
  const today = new Date();
  $("#date").value =
    item?.rawDate ||
    (monthKey(appState.selectedMonth) === monthKey(today)
      ? localDate(today)
      : localDate(appState.selectedMonth));
  $("#category").value = item?.category || "";
  $("#paid").checked = item ? isPaid(item) : true;
  $("#schedule").value =
    item?.totalInstallments > 1
      ? "installments"
      : item?.recurring
        ? "fixed"
        : "once";
  $("#installments").value = item?.totalInstallments || 2;
  $("#schedule").disabled = !!item;
  $("#installments").disabled = !!item;
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.disabled = !!item && (item.totalInstallments > 1 || item.recurring);
  });
  updateCategoryHint();
  setType(item?.type === "income" ? "income" : "expense");
  $("#transactionDialog").showModal();
  $("#description").focus();
}

export function updateCategoryHint() {
  $("#categoryHint").textContent =
    categoryHints[$("#category").value] ||
    "Você também pode digitar outra categoria.";
}

export function updateSchedule() {
  const item = appState.transactions.find(
    (row) => row.id === appState.editingId,
  );
  const schedule =
    appState.formType === "income" ? "once" : $("#schedule").value;
  $("#installmentsField").hidden = schedule !== "installments";
  $("#installments").required = schedule === "installments" && !item;
  $("#amountLabel").textContent =
    schedule === "installments"
      ? item
        ? "Valor desta parcela (R$)"
        : "Valor total da compra (R$)"
      : "Valor (R$)";
  $("#dateLabel").textContent =
    schedule === "installments"
      ? item
        ? "Vencimento desta parcela"
        : "Data da primeira parcela"
      : schedule === "fixed"
        ? "Primeiro vencimento"
        : "Data";
  $("#paidLabel").textContent =
    schedule === "installments" && !item
      ? "Primeira parcela já foi paga"
      : "Já foi paga";
  let note = "";
  if (item && (item.recurring || item.totalInstallments > 1))
    note =
      "A edição altera somente este lançamento. A programação dos outros meses é preservada.";
  else if (schedule === "fixed")
    note =
      "Repete todo mês a partir desta data. Os próximos meses começam como pendentes.";
  else if (schedule === "installments") {
    const count = Number($("#installments").value);
    const total = Math.round(Number($("#amount").value) * 100);
    note = `A compra será dividida em ${Number.isInteger(count) && count >= 2 ? count : "várias"} parcelas mensais. As seguintes começam como pendentes.`;
    if (
      Number.isInteger(count) &&
      count >= 2 &&
      count <= 360 &&
      total >= count
    ) {
      const base = Math.floor(total / count);
      const remainder = total % count;
      note = remainder
        ? `${remainder} parcela(s) de ${money((base + 1) / 100)} e ${count - remainder} de ${money(base / 100)}. O total fica exatamente ${money(total / 100)}.`
        : `${count} parcelas de ${money(base / 100)}. Total de ${money(total / 100)}.`;
    }
  }
  $("#scheduleNote").textContent = note;
  $("#scheduleNote").hidden = !note;
}

export function newInstallment() {
  openForm();
  $("#schedule").value = "installments";
  $("#paid").checked = false;
  updateSchedule();
}
