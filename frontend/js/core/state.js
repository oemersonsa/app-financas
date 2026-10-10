import { mainCategories } from "../domain/categories.js";

export const appState = {
  storageUnavailable: false,
  serverReady: false,
  serverRevision: 0,
  saving: false,
  storageCorrupt: false,
  transactions: [],
  categories: [...mainCategories, "Salário", "Outros"],
  selectedMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: "all",
  formType: "expense",
  editingId: null,
  deletingId: null,
  deletingPlan: null,
  toastTimer: undefined,
};
