import { validTransaction } from "../domain/validation.js";
import { appState } from "../core/state.js";
import { notify } from "../ui/shared.js";

export const STORAGE_KEY = "finances_transactions_v3";

export const CATEGORY_KEY = "finances_categories";

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(validTransaction))
        throw new Error("invalid");
      appState.transactions = parsed;
    }
  } catch (error) {
    appState.storageCorrupt = true;
    notify(
      "Não foi possível ler os registros. Os dados originais foram preservados; baixe um backup antes de continuar.",
      true,
    );
  }
  try {
    const savedCategories = JSON.parse(
      localStorage.getItem(CATEGORY_KEY) || "[]",
    );
    if (Array.isArray(savedCategories))
      appState.categories = [
        ...new Set([
          ...appState.categories,
          ...savedCategories
            .map((item) => (typeof item === "string" ? item : item?.name))
            .filter((item) => typeof item === "string" && item.length),
        ]),
      ];
  } catch {
    /* A categoria dos registros continua disponível mesmo sem preferências. */
  }
}
