import { monthlyItems } from "../domain/transactions.js";
import { appState } from "../core/state.js";
import { $ } from "./shared.js";
import { escapeHTML, money } from "../core/format.js";
import { isPaid } from "../domain/installments.js";
import { categoryStyle } from "../domain/categories.js";
import { svg } from "./icons.js";
import { renderInstallments } from "./installments.js";

export function render() {
  const items = monthlyItems(appState.transactions, appState.selectedMonth);
  const expenses = items.filter((item) => item.type !== "income");
  // Soma em centavos para evitar diferenças de arredondamento entre lançamentos.
  const sum = (rows) =>
    rows.reduce((total, item) => total + Math.round(item.amount * 100), 0) /
    100;
  const expense = sum(expenses);
  const income = sum(items.filter((item) => item.type === "income"));
  const monthName = appState.selectedMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  $("#monthLabel").textContent =
    monthName[0].toUpperCase() + monthName.slice(1);
  $("#totalExpense").textContent = money(expense);
  $("#totalIncome").textContent = money(income);
  $("#balanceDisplay").textContent = money(income - expense);
  $("#balanceDisplay").classList.toggle("negative", income < expense);
  $("#expenseNote").textContent = expenses.length
    ? `${expenses.length} ${expenses.length === 1 ? "despesa registrada" : "despesas registradas"} no mês`
    : "Tudo começa com o primeiro registro.";
  $("#transactionCount").textContent =
    `${items.length} ${items.length === 1 ? "lançamento neste mês" : "lançamentos neste mês"}`;
  const pending = expenses.filter((item) => !isPaid(item)).length;
  $("#pendingCount").textContent = pending
    ? `${pending} ${pending === 1 ? "pendente" : "pendentes"}`
    : "Tudo em dia";
  $("#pendingCount").classList.toggle("pending", pending > 0);
  const query = $("#searchInput").value.trim().toLocaleLowerCase("pt-BR");
  const visible = items
    .filter(
      (item) =>
        (appState.filter === "all" ||
          (appState.filter === "income"
            ? item.type === "income"
            : item.type !== "income")) &&
        `${item.description} ${item.category || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(query),
    )
    .sort(
      (a, b) =>
        b.rawDate.localeCompare(a.rawDate) ||
        (b.timestamp || 0) - (a.timestamp || 0),
    );
  $("#transactionList").innerHTML = visible
    .map((item) => {
      const name =
        item.category || (item.type === "income" ? "Entrada" : "Outros");
      const [icon, color] = categoryStyle(name);
      const date = new Date(`${item.rawDate}T12:00:00`).toLocaleDateString(
        "pt-BR",
        { day: "2-digit", month: "short" },
      );
      const extra =
        item.totalInstallments > 1
          ? ` · Parcela ${Number(item.installmentNumber) || 1}/${Number(item.totalInstallments)}`
          : item.recurring
            ? " · Mensal"
            : "";
      const id = escapeHTML(item.id);
      return `<li class="transaction-item"><span class="category-icon" style="color:${color};background:${color}18">${svg(item.type === "income" ? "in" : icon)}</span><div class="transaction-info"><h3>${escapeHTML(item.description)}</h3><p>${escapeHTML(name)} · ${escapeHTML(date)}${escapeHTML(extra)}</p></div><strong class="transaction-amount ${item.type === "income" ? "income" : ""}">${item.type === "income" ? "+ " : ""}${money(item.amount)}</strong>${item.type !== "income" ? `<button class="payment-toggle ${isPaid(item) ? "is-paid" : ""}" data-action="paid" data-id="${id}" aria-label="${isPaid(item) ? "Marcar como pendente" : "Marcar como paga"}: ${escapeHTML(item.description)}" title="${isPaid(item) ? "Paga" : "Pendente"}">${svg(isPaid(item) ? "check" : "circle")}</button>` : ""}<div class="row-actions"><button class="icon-button" data-action="edit" data-id="${id}" aria-label="Editar ${escapeHTML(item.description)}">${svg("edit")}</button><button class="icon-button" data-action="delete" data-id="${id}" aria-label="Excluir ${escapeHTML(item.description)}">${svg("trash")}</button></div></li>`;
    })
    .join("");
  $("#emptyState").hidden = visible.length > 0;
  const hasFilter = !!query || appState.filter !== "all";
  $("#emptyState h3").textContent = hasFilter
    ? "Nenhum resultado por aqui."
    : "Um começo mais leve.";
  $("#emptyState p").textContent = hasFilter
    ? "Tente outra busca ou selecione outro filtro."
    : "Adicione um lançamento para começar a acompanhar seu mês.";
  $("#emptyAdd").hidden = hasFilter;
  const groups = new Map();
  expenses.forEach((item) => {
    const name = item.category || "Outros";
    groups.set(name, (groups.get(name) || 0) + Math.round(item.amount * 100));
  });
  $("#categoryChart").innerHTML =
    [...groups]
      .sort((a, b) => b[1] - a[1])
      .map(([name, cents]) => {
        const [, color] = categoryStyle(name);
        const percent = expense ? (cents / (expense * 100)) * 100 : 0;
        return `<div class="category-entry"><div class="category-entry-heading"><span><span class="category-dot" style="background:${color}"></span>${escapeHTML(name)}</span><strong>${money(cents / 100)}</strong></div><div class="bar-track" role="img" aria-label="${escapeHTML(name)}: ${Math.round(percent)}% das despesas"><div class="bar-fill" style="background:${color};width:${percent}%"></div></div></div>`;
      })
      .join("") ||
    '<p class="chart-empty">Suas categorias aparecem aqui<br>depois da primeira despesa.</p>';
  $("#categoryTotal").textContent = money(expense);
  const names = [
    ...new Set([
      ...appState.categories,
      ...appState.transactions.map((item) => item.category).filter(Boolean),
    ]),
  ];
  renderInstallments();
  $("#categoryOptions").innerHTML = names
    .map((name) => `<option value="${escapeHTML(name)}"></option>`)
    .join("");
}
