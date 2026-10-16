import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMonth, filterTransactions, dueLabel } from "../frontend/js/domain/summary.js";

const rows = [
  { id: "salary", type: "income", description: "Salário", amount: 1000, rawDate: "2026-10-01", category: "Salário", paid: true },
  { id: "paid", type: "expense", description: "Mercado", amount: 100.10, rawDate: "2026-10-05", category: "Alimentação", paid: true },
  { id: "pending", type: "fixed", description: "Aluguel", amount: 200.20, rawDate: "2026-10-10", category: "Moradia", paid: false },
];

test("summary distinguishes paid and pending expenses without deducting pending twice", () => {
  const result = summarizeMonth(rows);
  assert.equal(result.income, 1000);
  assert.equal(result.expenses, 300.30);
  assert.equal(result.balance, 699.70);
  assert.equal(result.paidExpenses, 100.10);
  assert.equal(result.pendingAmount, 200.20);
  assert.deepEqual(result.pending.map(item => item.id), ["pending"]);
  assert.equal(summarizeMonth([]).balance, 0);
});

test("filters combine pending status and category search without mutating input order", () => {
  assert.deepEqual(filterTransactions(rows, "pending", "MORADIA").map(item => item.id), ["pending"]);
  assert.deepEqual(filterTransactions(rows, "income").map(item => item.id), ["salary"]);
  assert.deepEqual(filterTransactions(rows, "expense").map(item => item.id), ["pending", "paid"]);
  assert.deepEqual(rows.map(item => item.id), ["salary", "paid", "pending"]);
});

test("due labels handle overdue dates, month ends and the next year", () => {
  assert.equal(dueLabel("2026-12-30", "2026-12-31"), "Em atraso");
  assert.equal(dueLabel("2026-12-31", "2026-12-31"), "Hoje");
  assert.equal(dueLabel("2027-01-01", "2026-12-31"), "Amanhã");
  assert.equal(dueLabel("2027-01-02", "2026-12-31"), "Em 2 dias");
});
