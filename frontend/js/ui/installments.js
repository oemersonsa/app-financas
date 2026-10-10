import {
  installmentGroups,
  installmentKey,
  isPaid,
} from "../domain/installments.js";
import { appState } from "../core/state.js";
import { $ } from "./shared.js";
import { escapeHTML, money } from "../core/format.js";
import { svg } from "./icons.js";

export function renderInstallments() {
  // A página reúne todos os meses; pagamento depende da marcação, nunca do vencimento.
  const opened = new Set(
    [...document.querySelectorAll(".installment-plan[open]")].map(
      (el) => el.dataset.plan,
    ),
  );
  const groups = installmentGroups(appState.transactions);
  const all = groups.flat();
  const paid = all.filter(isPaid);
  const cents = (items) =>
    items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
  $("#installmentsRemaining").textContent = money(
    (cents(all) - cents(paid)) / 100,
  );
  $("#installmentsPaid").textContent = money(cents(paid) / 100);
  $("#installmentsTotal").textContent = money(cents(all) / 100);
  const remainingCount = all.length - paid.length;
  $("#installmentsRemainingCount").textContent =
    `${remainingCount} ${remainingCount === 1 ? "parcela em aberto" : "parcelas em aberto"}`;
  $("#installmentsPaidCount").textContent =
    `${paid.length} ${paid.length === 1 ? "parcela paga" : "parcelas pagas"}`;
  $("#installmentsPlanCount").textContent =
    `${groups.length} ${groups.length === 1 ? "parcelamento" : "parcelamentos"}`;
  $("#installmentsEmpty").hidden = groups.length > 0;
  $("#installmentPlans").innerHTML = groups
    .map((items) => {
      const first = items[0];
      const key = installmentKey(first);
      const paidItems = items.filter(isPaid);
      const paidCents = cents(paidItems);
      const total = cents(items);
      const totalCount = first.totalInstallments;
      const missing = Math.max(0, totalCount - items.length);
      const countLabel = `${paidItems.length} pagas · ${items.length - paidItems.length} faltam pagar${missing ? ` · ${missing} não encontradas no backup` : ""}`;
      return `<details class="panel installment-plan" data-plan="${escapeHTML(key)}" ${opened.has(key) ? "open" : ""}>
      <summary><div class="plan-title"><span class="category-icon">${svg("receipt")}</span><div><h2>${escapeHTML(first.description)}</h2><p>${escapeHTML(first.category || "Outros")} · ${totalCount} parcelas</p></div><span class="plan-chevron">${svg("right")}</span></div>
      <div class="plan-progress-label"><span>${countLabel}</span><strong>${money(total / 100)}</strong></div><progress value="${paidItems.length}" max="${totalCount}" aria-label="${paidItems.length} de ${totalCount} parcelas pagas"></progress>
      <div class="plan-amounts"><span>Já foi pago <strong>${money(paidCents / 100)}</strong></span><span>Falta pagar <strong>${money((total - paidCents) / 100)}</strong></span></div>${missing ? '<p class="field-hint">Os valores consideram somente as parcelas disponíveis.</p>' : ""}</summary>
      <ul class="plan-installments">${items.map((item) => `<li class="installment-row ${isPaid(item) ? "paid-row" : ""}"><button class="payment-toggle ${isPaid(item) ? "is-paid" : ""}" data-action="paid" data-id="${escapeHTML(item.id)}" aria-label="${isPaid(item) ? "Marcar como pendente" : "Marcar como paga"}: parcela ${item.installmentNumber} de ${escapeHTML(item.description)}">${svg(isPaid(item) ? "check" : "circle")}</button><div class="installment-row-info"><strong>Parcela ${item.installmentNumber} de ${totalCount}</strong><span>${new Date(`${item.rawDate}T12:00:00`).toLocaleDateString("pt-BR")} · ${isPaid(item) ? "Paga" : "Pendente"}</span></div><strong>${money(item.amount)}</strong><button class="icon-button" data-action="edit" data-id="${escapeHTML(item.id)}" aria-label="Editar parcela ${item.installmentNumber} de ${escapeHTML(item.description)}">${svg("edit")}</button></li>`).join("")}</ul>
      <div class="plan-footer"><button class="text-button" data-action="delete" data-id="${escapeHTML(first.id)}">Excluir parcelamento</button></div>
    </details>`;
    })
    .join("");
}
