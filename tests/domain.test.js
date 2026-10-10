import test from "node:test";
import assert from "node:assert/strict";
import {
  offsetMonth,
  installmentGroups,
  installmentKey,
} from "../frontend/js/domain/installments.js";
import {
  buildNextTransactions,
  monthlyItems,
  removeTransaction,
} from "../frontend/js/domain/transactions.js";
import { recurringCopies } from "../frontend/js/domain/recurrence.js";
import { validTransaction } from "../frontend/js/domain/validation.js";

const purchase = {
  id: "purchase",
  description: "Compra",
  amount: 100,
  type: "expense",
  rawDate: "2026-01-31",
  paid: true,
};
const fixed = {
  ...purchase,
  id: "rent",
  type: "fixed",
  recurring: true,
  category: "Moradia",
};

test("parcelamento preserva o total e o pagamento só da primeira parcela", () => {
  const rows = buildNextTransactions([], purchase, {
    schedule: "installments",
    count: 3,
  });
  assert.deepEqual(
    rows.map((row) => row.amount),
    [33.34, 33.33, 33.33],
  );
  assert.equal(
    rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0),
    10000,
  );
  assert.deepEqual(
    rows.map((row) => row.paid),
    [true, false, false],
  );
  assert.equal(new Set(rows.map((row) => row.id)).size, 3);
  assert.equal(installmentGroups(rows).length, 1);
});

test("vencimentos preservam o dia original após meses curtos e mudança de ano", () => {
  assert.equal(offsetMonth("2026-01-31", 1), "2026-02-28");
  assert.equal(offsetMonth("2026-01-31", 2), "2026-03-31");
  assert.equal(offsetMonth("2024-01-31", 1), "2024-02-29");
  assert.equal(offsetMonth("2026-12-31", 1), "2027-01-31");
});

test("conta fixa começa pendente e não duplica ocorrência nem mês inicial", () => {
  assert.deepEqual(recurringCopies([fixed], new Date(2026, 0, 1)), []);
  const [copy] = recurringCopies(
    [fixed],
    new Date(2026, 1, 1),
    () => "february",
  );
  assert.equal(copy.rawDate, "2026-02-28");
  assert.equal(copy.paid, false);
  assert.deepEqual(recurringCopies([fixed, copy], new Date(2026, 1, 1)), []);
});

test("excluir o mês inicial mantém a programação, sem incluir a âncora nos totais", () => {
  const rows = removeTransaction([fixed], fixed.id);
  assert.equal(rows[0].recurringHidden, true);
  assert.deepEqual(monthlyItems(rows, new Date(2026, 0, 1)), []);
  const next = recurringCopies(rows, new Date(2026, 1, 1), () => "february");
  assert.equal(next.length, 1);
  assert.equal(next[0].recurringHidden, false);
});

test("excluir uma ocorrência evita sua recriação, preservando a origem", () => {
  const [copy] = recurringCopies(
    [fixed],
    new Date(2026, 1, 1),
    () => "february",
  );
  const rows = removeTransaction([fixed, copy], copy.id);
  assert.equal(rows.length, 1);
  assert.deepEqual(recurringCopies(rows, new Date(2026, 1, 1)), []);
  assert.equal(recurringCopies(rows, new Date(2026, 2, 1)).length, 1);
});

test("edição de parcela e exclusão de grupo preservam outros lançamentos", () => {
  const rows = buildNextTransactions([fixed], purchase, {
    schedule: "installments",
    count: 3,
  });
  const original = rows[2];
  const edited = buildNextTransactions(
    rows,
    { ...original, amount: 45 },
    { old: original },
  );
  assert.equal(edited[1].amount, rows[1].amount);
  assert.equal(edited[2].amount, 45);
  assert.deepEqual(
    removeTransaction(edited, original.id, installmentKey(original)),
    [fixed],
  );
});

test("validação rejeita datas inexistentes e metadados inválidos", () => {
  assert.equal(validTransaction(purchase), true);
  assert.equal(validTransaction({ ...purchase, rawDate: "2026-02-31" }), false);
  assert.equal(validTransaction({ ...purchase, amount: -1 }), false);
  assert.equal(validTransaction({ ...fixed, recurringAnchorDate: 100 }), false);
  assert.equal(
    validTransaction({
      ...purchase,
      totalInstallments: 2,
      installmentNumber: 3,
    }),
    false,
  );
});
