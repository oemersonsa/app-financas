import { appState } from "../core/state.js";

export const $ = (selector) => document.querySelector(selector);

export function notify(message, persistent = false) {
  clearTimeout(appState.toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  if (!persistent)
    appState.toastTimer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 4500);
}

export function setStorageStatus(message, error = false) {
  $("#storageStatus").textContent = message;
  $("#storageStatus").classList.toggle("storage-error", error);
}
