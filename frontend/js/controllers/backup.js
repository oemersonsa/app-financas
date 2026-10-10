import { $, notify } from "../ui/shared.js";
import { appState } from "../core/state.js";
import { STORAGE_KEY } from "../services/legacy.js";
import { localDate } from "../core/dates.js";
import { validTransaction } from "../domain/validation.js";
import { commit } from "../services/persistence.js";
import { render } from "../ui/overview.js";

export function bindBackup() {
  $("#backupButton").addEventListener("click", () =>
    $("#backupDialog").showModal(),
  );
  $("#exportButton").addEventListener("click", () => {
    let contents;
    try {
      contents = appState.storageCorrupt
        ? localStorage.getItem(STORAGE_KEY)
        : JSON.stringify(
            {
              version: 5,
              transactions: appState.transactions,
              customCategories: appState.categories.map((name) => ({ name })),
            },
            null,
            2,
          );
    } catch {
      notify("O navegador não permitiu acessar os dados para o backup.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([contents || "[]"], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `meu-bolso-${localDate()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Backup baixado. Guarde essa cópia em um lugar seguro.");
  });
  $("#importButton").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("size");
      const parsed = JSON.parse(await file.text());
      if (
        !Array.isArray(parsed.transactions) ||
        !parsed.transactions.every(validTransaction)
      )
        throw new Error("invalid");
      const ids = new Set(appState.transactions.map((item) => String(item.id)));
      const additions = [];
      for (const item of parsed.transactions) {
        if (!ids.has(String(item.id))) {
          additions.push(item);
          ids.add(String(item.id));
        }
      }
      const nextCategories = [
        ...new Set([
          ...appState.categories,
          ...(Array.isArray(parsed.customCategories)
            ? parsed.customCategories
                .map((item) => (typeof item === "string" ? item : item?.name))
                .filter((name) => typeof name === "string" && name.length)
            : []),
        ]),
      ];
      if (
        await commit([...appState.transactions, ...additions], nextCategories)
      ) {
        render();
        $("#backupDialog").close();
        notify(
          `${additions.length} ${additions.length === 1 ? "lançamento importado" : "lançamentos importados"}.`,
        );
      }
    } catch {
      notify(
        "Backup inválido. Escolha um arquivo JSON exportado pela aplicação (até 10 MB).",
      );
    } finally {
      event.target.value = "";
    }
  });
}
