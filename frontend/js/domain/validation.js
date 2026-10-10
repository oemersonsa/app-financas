import { localDate } from "../core/dates.js";

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value;
}

export function validTransaction(item) {
  return (
    item &&
    typeof item === "object" &&
    (typeof item.id === "string" ||
      (typeof item.id === "number" && Number.isFinite(item.id))) &&
    typeof item.description === "string" &&
    item.description.trim().length > 0 &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    item.amount >= 0 &&
    item.amount <= 999999999 &&
    ["income", "expense", "fixed", "subscription"].includes(item.type) &&
    validDate(item.rawDate) &&
    (item.category == null || typeof item.category === "string") &&
    (item.paid == null || typeof item.paid === "boolean") &&
    (item.totalInstallments == null ||
      (Number.isInteger(item.totalInstallments) &&
        item.totalInstallments >= 1 &&
        item.totalInstallments <= 360)) &&
    (item.installmentNumber == null ||
      (Number.isInteger(item.installmentNumber) &&
        item.installmentNumber >= 1 &&
        item.installmentNumber <= (item.totalInstallments || 1))) &&
    (item.installmentPlanId == null ||
      typeof item.installmentPlanId === "string") &&
    (item.recurring == null || typeof item.recurring === "boolean") &&
    (item.recurringHidden == null ||
      typeof item.recurringHidden === "boolean") &&
    (item.recurringAnchorDate == null || validDate(item.recurringAnchorDate)) &&
    (item.skippedMonths == null ||
      (Array.isArray(item.skippedMonths) &&
        item.skippedMonths.every((value) => validDate(`${value}-01`)))) &&
    (item.recurringTemplate == null ||
      (typeof item.recurringTemplate === "object" &&
        typeof item.recurringTemplate.description === "string" &&
        typeof item.recurringTemplate.amount === "number" &&
        Number.isFinite(item.recurringTemplate.amount) &&
        item.recurringTemplate.amount >= 0 &&
        item.recurringTemplate.amount <= 999999999 &&
        (item.recurringTemplate.category == null ||
          typeof item.recurringTemplate.category === "string")))
  );
}
