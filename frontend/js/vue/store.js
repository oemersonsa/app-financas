import { reactive } from "vue";
import { mainCategories } from "../domain/categories.js";
import { validTransaction } from "../domain/validation.js";
import { recurringCopies } from "../domain/recurrence.js";

export const state = reactive({
  transactions: [],
  categories: [...mainCategories, "Salário", "Outros"],
  revision: 0,
  ready: false,
  saving: false,
  status: "Conectando ao banco de dados…",
  message: "",
  error: false,
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  authRequired: false,
  corruptLegacy: null,
});
let timer;
export function notify(message, error = false) {
  state.message = message;
  state.error = error;
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.message = "";
  }, 6500);
}
const categoryNames = (items = []) =>
  items
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter((name) => typeof name === "string" && name.length);
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (response.status === 401) {
    location.replace("/login.html");
    throw new Error("session");
  }
  return response;
}
function adopt(document) {
  if (
    !Number.isSafeInteger(document.revision) ||
    !Array.isArray(document.data?.transactions) ||
    !document.data.transactions.every(validTransaction)
  )
    throw new Error("invalid");
  state.transactions = document.data.transactions;
  state.revision = document.revision;
  state.categories = [
    ...new Set([
      ...mainCategories,
      "Salário",
      "Outros",
      ...categoryNames(document.data.customCategories),
    ]),
  ];
}
export async function save(transactions, categories = state.categories) {
  if (!state.ready || state.saving) {
    notify(
      state.saving
        ? "Aguarde o salvamento atual."
        : "Conecte ao servidor para salvar.",
      true,
    );
    return false;
  }
  state.saving = true;
  state.status = "Salvando no servidor…";
  try {
    const response = await request("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revision: state.revision,
        data: {
          version: 5,
          transactions,
          customCategories: categories.map((name) => ({ name })),
        },
      }),
    });
    if (response.status === 409) {
      const current = await request("/api/state");
      if (!current.ok) throw new Error("read");
      adopt(await current.json());
      state.status = "Dados atualizados de outro dispositivo.";
      notify(
        "Outra aba ou dispositivo alterou os dados. Confira a lista e tente novamente.",
        true,
      );
      return false;
    }
    if (!response.ok) throw new Error("save");
    const result = await response.json();
    state.revision = result.revision;
    state.transactions = transactions;
    state.categories = [...categories];
    state.status = "Salvo no servidor · backup automático";
    return true;
  } catch {
    state.status = "Falha ao salvar. Seus dados atuais foram preservados.";
    notify(
      "O servidor não confirmou o salvamento. Confira sua conexão e tente novamente.",
      true,
    );
    return false;
  } finally {
    state.saving = false;
  }
}
export async function materialize() {
  const copies = recurringCopies(state.transactions, state.month);
  return !copies.length || (await save([...state.transactions, ...copies]));
}
export async function initialize() {
  try {
    const response = await request("/api/state");
    if (!response.ok) throw new Error("read");
    adopt(await response.json());
    state.ready = true;
    try {
      const raw = localStorage.getItem("finances_transactions_v3");
      if (raw) {
        let legacy;
        try {
          legacy = JSON.parse(raw);
          if (!Array.isArray(legacy) || !legacy.every(validTransaction))
            throw new Error("invalid");
        } catch {
          state.corruptLegacy = raw;
          notify(
            "O backup antigo está ilegível e foi preservado. Exporte uma cópia para recuperação.",
            true,
          );
        }
        if (
          legacy &&
          state.revision === 0 &&
          !state.transactions.length &&
          legacy.length
        ) {
          let categories = [];
          try {
            categories = categoryNames(
              JSON.parse(localStorage.getItem("finances_categories") || "[]"),
            );
          } catch {
            /* Preserve the original browser data. */
          }
          if (
            !(await save(legacy, [
              ...new Set([...state.categories, ...categories]),
            ]))
          ) {
            state.ready = false;
            return;
          }
        }
      }
    } catch {
      /* Browser storage is optional; server remains authoritative. */
    }
    state.status = "Dados no servidor · backup automático";
    await materialize();
  } catch {
    state.ready = false;
    state.status = "Sem conexão com o servidor · somente leitura";
    notify(
      "Não foi possível carregar os dados. Tente recarregar a página.",
      true,
    );
  }
  try {
    const response = await request("/api/session");
    if (response.ok) state.authRequired = (await response.json()).authRequired;
  } catch {
    /* State request reports availability. */
  }
}
export async function logout() {
  try {
    const response = await request("/api/logout", { method: "POST" });
    if (!response.ok) throw new Error("logout");
    location.replace("/login.html");
  } catch {
    notify("Não foi possível sair. Tente novamente.", true);
  }
}
export async function importBackup(file) {
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("size");
    const parsed = JSON.parse(await file.text());
    if (
      !Array.isArray(parsed.transactions) ||
      !parsed.transactions.every(validTransaction)
    )
      throw new Error("invalid");
    const ids = new Set(state.transactions.map((item) => String(item.id)));
    const additions = parsed.transactions.filter((item) => {
      if (ids.has(String(item.id))) return false;
      ids.add(String(item.id));
      return true;
    });
    const categories = [
      ...new Set([
        ...state.categories,
        ...categoryNames(parsed.customCategories),
      ]),
    ];
    if (!(await save([...state.transactions, ...additions], categories)))
      return false;
    notify(`${additions.length} lançamento(s) importado(s).`);
    return true;
  } catch {
    notify(
      "Backup inválido. Escolha um JSON exportado pela aplicação (até 10 MB).",
      true,
    );
    return false;
  }
}
