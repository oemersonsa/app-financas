import { initializeSession } from "./controllers/session.js";
import { loadData } from "./services/legacy.js";
import { appState } from "./core/state.js";
import { commit, readServer } from "./services/persistence.js";
import { mainCategories } from "./domain/categories.js";
import { notify, setStorageStatus } from "./ui/shared.js";
import { materializeRecurring } from "./services/recurrence.js";
import { render } from "./ui/overview.js";
import { showPage } from "./ui/navigation.js";
import { initializeIcons } from "./ui/icons.js";
import { bindDialogs } from "./ui/dialogs.js";
import { bindForm } from "./controllers/form.js";
import { bindNavigation } from "./controllers/navigation.js";
import { bindTransactionActions } from "./controllers/transactions.js";
import { bindBackup } from "./controllers/backup.js";

export async function initializeServer() {
  // Ler a versão antiga apenas para migração. Não grava mais registros no navegador.
  loadData();
  const legacy = appState.transactions;
  const legacyCategories = appState.categories;
  try {
    const state = await readServer();
    appState.serverReady = true;
    appState.serverRevision = state.revision;
    appState.transactions = state.data.transactions;
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
    if (
      state.revision === 0 &&
      !state.data.transactions.length &&
      legacy.length &&
      !appState.storageCorrupt
    ) {
      if (!(await commit(legacy, legacyCategories))) {
        appState.serverReady = false;
        appState.transactions = legacy;
      } else
        notify(
          "Seus registros antigos foram importados para o banco de dados.",
        );
    }
    // Dado local ilegível fica preservado para recuperação, mas não bloqueia o banco.
    if (appState.storageCorrupt)
      notify(
        "O backup antigo deste navegador está ilegível e foi preservado. Os dados do servidor foram carregados.",
        true,
      );
    appState.storageCorrupt = false;
    if (appState.serverReady) {
      setStorageStatus("Dados no servidor · backup automático");
      await materializeRecurring();
    }
  } catch {
    appState.serverReady = false;
    appState.transactions = legacy;
    setStorageStatus("Sem conexão com o servidor · somente leitura", true);
    notify(
      "Abra a aplicação pelo servidor Meu bolso. Os registros não serão salvos somente no navegador.",
      true,
    );
  }
  render();
  showPage();
}

initializeIcons();
bindDialogs();
bindForm();
bindNavigation();
bindTransactionActions();
bindBackup();
render();
showPage();
initializeServer();

initializeSession();
