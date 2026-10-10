import { monthKey } from "../core/dates.js";
import { installmentKey, offsetMonth } from "./installments.js";

export function monthlyItems(transactions, selectedMonth) {
  return transactions.filter(
    (item) =>
      !item.recurringHidden &&
      item.rawDate.slice(0, 7) === monthKey(selectedMonth),
  );
}

export function buildNextTransactions(
  transactions,
  updated,
  { old, schedule, count },
) {
  const date = updated.rawDate;
  const totalCents = Math.round(updated.amount * 100);
  let next;
  if (old)
    next = transactions.map((item) => (item.id === old.id ? updated : item));
  else if (schedule === "installments") {
    const planId = crypto.randomUUID();
    const base = Math.floor(totalCents / count);
    const remainder = totalCents % count;
    const installments = Array.from({ length: count }, (_, index) => {
      const installmentDate = offsetMonth(date, index);
      return {
        ...updated,
        id: index === 0 ? updated.id : crypto.randomUUID(),
        installmentPlanId: planId,
        parentId: index === 0 ? null : updated.id,
        totalInstallments: count,
        installmentNumber: index + 1,
        amount: (base + (index < remainder ? 1 : 0)) / 100,
        rawDate: installmentDate,
        monthKey: installmentDate.slice(0, 7),
        date: new Date(`${installmentDate}T12:00:00`).toLocaleDateString(
          "pt-BR",
        ),
        paid: index === 0 && updated.paid,
      };
    });
    next = [...transactions, ...installments];
  } else next = [...transactions, updated];

  return next;
}

export function removeTransaction(transactions, id, plan = null) {
  const target = transactions.find((item) => item.id === id);
  let next = transactions.filter((item) =>
    plan ? installmentKey(item) !== plan : item.id !== id,
  );
  if (target?.recurring && target.parentId) {
    next = next.map((item) =>
      String(item.id) === String(target.parentId)
        ? {
            ...item,
            skippedMonths: [
              ...new Set([
                ...(Array.isArray(item.skippedMonths)
                  ? item.skippedMonths
                  : []),
                target.rawDate.slice(0, 7),
              ]),
            ],
          }
        : item,
    );
  }
  if (target?.recurring && !target.parentId) {
    next.push({
      ...target,
      recurringHidden: true,
      skippedMonths: [
        ...new Set([
          ...(target.skippedMonths || []),
          target.rawDate.slice(0, 7),
        ]),
      ],
    });
  }

  return next;
}
