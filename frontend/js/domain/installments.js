import { localDate } from "../core/dates.js";

export function isPaid(item) {
  if (typeof item.paid === "boolean") return item.paid;
  return item.totalInstallments > 1 ? item.rawDate <= localDate() : true;
}

export function offsetMonth(date, delta) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year, month - 1 + delta, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, lastDay));
  return localDate(target);
}

export function installmentKey(item) {
  if (!(item.totalInstallments > 1)) return null;
  return item.installmentPlanId || `legacy:${item.parentId ?? item.id}`;
}

export function installmentGroups(transactions) {
  const groups = new Map();
  transactions
    .filter((item) => item.totalInstallments > 1)
    .forEach((item) => {
      const key = installmentKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
  return [...groups.values()].map((items) =>
    items.sort((a, b) => a.installmentNumber - b.installmentNumber),
  );
}
