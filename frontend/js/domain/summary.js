import { isPaid } from "./installments.js";
import { localDate } from "../core/dates.js";

export const sumAmounts = rows =>
  rows.reduce((total, item) => total + Math.round(item.amount * 100), 0) / 100;

export function summarizeMonth(items) {
  const incomes = items.filter(item => item.type === "income");
  const expenses = items.filter(item => item.type !== "income");
  const pending = expenses.filter(item => !isPaid(item));
  const income = sumAmounts(incomes), expense = sumAmounts(expenses);
  return {
    income, expenses: expense, balance: (Math.round(income * 100) - Math.round(expense * 100)) / 100,
    pending, pendingAmount: sumAmounts(pending),
    paidExpenses: sumAmounts(expenses.filter(isPaid)),
  };
}

export function filterTransactions(items, filter = "all", search = "") {
  const query = search.toLocaleLowerCase("pt-BR");
  return items.filter(item =>
    (filter === "all" || (filter === "income" ? item.type === "income"
      : filter === "pending" ? item.type !== "income" && !isPaid(item)
      : item.type !== "income")) &&
    `${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(query),
  ).sort((a, b) => b.rawDate.localeCompare(a.rawDate) || (b.timestamp || 0) - (a.timestamp || 0));
}

export function dueLabel(date, today = localDate()) {
  const days = Math.round((new Date(date + "T12:00:00") - new Date(today + "T12:00:00")) / 86400000);
  return days < 0 ? "Em atraso" : days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`;
}
