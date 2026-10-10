import { appState } from "../core/state.js";
import { openForm } from "../ui/forms.js";
import { commit } from "../services/persistence.js";
import { installmentKey, isPaid } from "../domain/installments.js";
import { render } from "../ui/overview.js";
import { $, notify } from "../ui/shared.js";
import { money } from "../core/format.js";
import { removeTransaction } from "../domain/transactions.js";

export async function handleTransactionAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const item = appState.transactions.find(
    (row) => String(row.id) === button.dataset.id,
  );
  if (!item) return;
  if (button.dataset.action === "edit") openForm(item);
  if (button.dataset.action === "paid") {
    if (
      await commit(
        appState.transactions.map((row) =>
          row.id === item.id ? { ...row, paid: !isPaid(row) } : row,
        ),
      )
    ) {
      render();
      notify(
        isPaid(item)
          ? "Despesa marcada como pendente."
          : "Despesa marcada como paga.",
      );
    }
  }
  if (button.dataset.action === "delete") {
    appState.deletingId = item.id;
    appState.deletingPlan =
      item.totalInstallments > 1 ? installmentKey(item) : null;
    $("#deleteDialog h2").textContent = appState.deletingPlan
      ? "Excluir parcelamento?"
      : "Excluir lançamento?";
    $("#deleteDescription").textContent =
      `${item.description} — ${money(item.amount)}`;
    $("#deleteHint").textContent = appState.deletingPlan
      ? "Todas as parcelas deste parcelamento serão excluídas, inclusive as já pagas."
      : "Somente este lançamento será excluído.";
    $("#deleteDialog").showModal();
  }
}

export function bindTransactionActions() {
  $("#transactionList").addEventListener("click", handleTransactionAction);
  $("#installmentPlans").addEventListener("click", handleTransactionAction);
  $("#confirmDelete").addEventListener("click", async () => {
    // Excluir somente o mês escolhido. Uma cópia mensal permanece como origem
    // se o registro removido for a origem de uma série antiga.
    const next = removeTransaction(
      appState.transactions,
      appState.deletingId,
      appState.deletingPlan,
    );
    if (await commit(next)) {
      render();
      $("#deleteDialog").close();
      notify("Lançamento excluído.");
    }
  });
}
