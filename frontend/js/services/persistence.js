import { validTransaction } from "../domain/validation.js";
import { appState } from "../core/state.js";
import { notify, setStorageStatus } from "../ui/shared.js";
import { mainCategories } from "../domain/categories.js";
import { render } from "../ui/overview.js";

export async function readServer() {
  const response = await fetch("/api/state", {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) { location.replace("/login.html"); throw new Error("session"); }
  if (!response.ok) throw new Error("server");
  const state = await response.json();
  if (
    !Array.isArray(state.data?.transactions) ||
    !state.data.transactions.every(validTransaction) ||
    !Number.isInteger(state.revision)
  )
    throw new Error("invalid");
  return state;
}

export async function commit(next, nextCategories = appState.categories) {
  if (!appState.serverReady) {
    notify(
      "O servidor está indisponível. Não foi salvo no navegador; conecte ao servidor para salvar.",
      true,
    );
    return false;
  }
  if (appState.saving) {
    notify("Aguarde o salvamento atual antes de continuar.");
    return false;
  }
  appState.saving = true;
  setStorageStatus("Salvando no servidor…");
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revision: appState.serverRevision,
        data: {
          version: 5,
          transactions: next,
          customCategories: nextCategories.map((name) => ({ name })),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) { location.replace("/login.html"); throw new Error("session"); }
    if (response.status === 409) {
      const state = await readServer();
      appState.transactions = state.data.transactions;
      appState.serverRevision = state.revision;
      appState.categories = [
        ...new Set([
          ...mainCategories,
          "Salário",
          "Outros",
          ...(state.data.customCategories || []).map((item) =>
            typeof item === "string" ? item : item.name,
          ),
        ]),
      ];
      render();
      setStorageStatus("Dados atualizados de outro dispositivo.");
      notify(
        "Outra aba ou dispositivo alterou os dados. Atualizei a lista; confira e tente novamente.",
        true,
      );
      return false;
    }
    if (!response.ok) throw new Error("save");
    const result = await response.json();
    appState.serverRevision = result.revision;
    appState.transactions = next;
    appState.categories = nextCategories;
    appState.storageUnavailable = false;
    setStorageStatus("Salvo no servidor · backup automático");
    return true;
  } catch {
    appState.storageUnavailable = true;
    setStorageStatus(
      "Falha ao salvar. Seus dados atuais foram preservados.",
      true,
    );
    notify(
      "O servidor não confirmou o salvamento. Confira sua conexão e tente novamente.",
      true,
    );
    return false;
  } finally {
    appState.saving = false;
  }
}
