import { reactive, computed } from "vue";
import { state, save, materialize, notify } from "./store.js";
import { localDate, monthKey } from "../core/dates.js";
import { validDate } from "../domain/validation.js";
import { buildNextTransactions } from "../domain/transactions.js";
import { isPaid } from "../domain/installments.js";
import { money } from "../core/format.js";
export function useTransactionForm(dialog, afterSave) {
  const form = reactive({
    old: null,
    description: "",
    amount: "",
    date: "",
    category: "",
    type: "expense",
    schedule: "once",
    count: 2,
    paid: true,
    error: "",
  });
  function open(item = null, schedule = "once") {
    Object.assign(form, {
      old: item,
      description: item?.description || "",
      amount: item?.amount ?? "",
      date:
        item?.rawDate ||
        (monthKey(state.month) === monthKey(new Date())
          ? localDate()
          : localDate(state.month)),
      category: item?.category || "",
      type: item?.type === "income" ? "income" : "expense",
      schedule:
        item?.totalInstallments > 1
          ? "installments"
          : item?.recurring
            ? "fixed"
            : schedule,
      count: item?.totalInstallments || 2,
      paid: item ? isPaid(item) : schedule === "once",
      error: "",
    });
    dialog.value.showModal();
    document.querySelector("#description").focus();
  }
  function setType(type) {
    form.type = type;
    if (type === "income") form.schedule = "once";
  }
  const note = computed(() => {
    if (form.old && (form.old.recurring || form.old.totalInstallments > 1))
      return "A edição altera somente este lançamento. A programação dos outros meses é preservada.";
    if (form.schedule === "fixed")
      return "Repete todo mês. Os próximos vencimentos começam como pendentes.";
    if (form.schedule !== "installments") return "";
    const count = Number(form.count),
      cents = Math.round(Number(form.amount) * 100);
    if (!Number.isInteger(count) || count < 2 || count > 360 || cents < count)
      return "Escolha de 2 a 360 parcelas mensais.";
    const base = Math.floor(cents / count),
      remainder = cents % count;
    return remainder
      ? `${remainder} parcela(s) de ${money((base + 1) / 100)} e ${count - remainder} de ${money(base / 100)}. Total de ${money(cents / 100)}.`
      : `${count} parcelas de ${money(base / 100)}. Total de ${money(cents / 100)}.`;
  });
  async function submit() {
    form.error = "";
    const amount = Number(form.amount),
      count = Number(form.count),
      old = form.old,
      date = form.date;
    if (
      !form.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999 ||
      !validDate(date)
    ) {
      form.error =
        "Preencha a descrição, uma data válida e um valor maior que zero.";
      return;
    }
    const schedule = form.type === "income" ? "once" : form.schedule,
      cents = Math.round(amount * 100);
    if (
      !old &&
      schedule === "installments" &&
      (!Number.isInteger(count) || count < 2 || count > 360 || cents < count)
    ) {
      form.error =
        "Escolha de 2 a 360 parcelas, com pelo menos R$ 0,01 por parcela.";
      return;
    }
    const updated = {
      ...old,
      id: old?.id ?? crypto.randomUUID(),
      description: form.description.trim(),
      amount: cents / 100,
      type:
        schedule === "fixed"
          ? old?.type === "subscription"
            ? "subscription"
            : "fixed"
          : form.type,
      category: form.category.trim(),
      rawDate: date,
      monthKey: date.slice(0, 7),
      date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR"),
      timestamp: old?.timestamp ?? Date.now(),
      paid: form.type === "income" || form.paid,
      recurring: schedule === "fixed",
    };
    if (
      (!old && schedule === "fixed") ||
      (old?.recurring && !old.recurringTemplate)
    ) {
      updated.recurringAnchorDate =
        old?.recurringAnchorDate || old?.rawDate || date;
      updated.recurringTemplate = {
        description: old?.description || updated.description,
        amount: old?.amount ?? updated.amount,
        category: old?.category ?? updated.category,
      };
    }
    const next = buildNextTransactions(state.transactions, updated, {
      old,
      schedule,
      count,
    });
    const categories = form.category.trim()
      ? [...new Set([...state.categories, form.category.trim()])]
      : state.categories;
    if (!(await save(next, categories))) {
      form.error = `O lançamento não foi salvo. ${state.message || "Tente novamente."}`;
      return;
    }
    state.month = new Date(`${date.slice(0, 7)}-01T12:00:00`);
    await materialize();
    dialog.value.close();
    afterSave(!old && schedule === "installments");
    notify(
      old
        ? "Lançamento atualizado."
        : "Lançamento salvo. Um a menos para lembrar.",
    );
  }
  return { form, open, setType, note, submit };
}
