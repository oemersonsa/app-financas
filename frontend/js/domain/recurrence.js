import { monthKey } from "../core/dates.js";

export function recurringCopies(
  transactions,
  selectedMonth,
  makeId = () => crypto.randomUUID(),
) {
  const key = monthKey(selectedMonth);
  const copies = [];
  transactions
    .filter(
      (item) =>
        item.recurring &&
        !item.parentId &&
        ["fixed", "subscription"].includes(item.type),
    )
    .forEach((parent) => {
      if (
        (Array.isArray(parent.skippedMonths) &&
          parent.skippedMonths.includes(key)) ||
        key <= parent.rawDate.slice(0, 7) ||
        transactions.some(
          (item) =>
            String(item.parentId) === String(parent.id) &&
            item.rawDate.slice(0, 7) === key,
        )
      )
        return;
      const anchor = parent.recurringAnchorDate || parent.rawDate;
      const day = Math.min(
        Number(anchor.slice(8, 10)),
        new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth() + 1,
          0,
        ).getDate(),
      );
      const date = `${key}-${String(day).padStart(2, "0")}`;
      copies.push({
        ...parent,
        ...(parent.recurringTemplate || {}),
        id: makeId(),
        parentId: parent.id,
        rawDate: date,
        monthKey: key,
        date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR"),
        paid: false,
        recurringHidden: false,
      });
    });
  return copies;
}
