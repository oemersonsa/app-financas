import { appState } from "../core/state.js";
import { recurringCopies } from "../domain/recurrence.js";
import { commit } from "./persistence.js";

export async function materializeRecurring() {
  if (!appState.serverReady || appState.storageCorrupt || appState.saving)
    return;
  const copies = recurringCopies(appState.transactions, appState.selectedMonth);
  if (copies.length) await commit([...appState.transactions, ...copies]);
}
