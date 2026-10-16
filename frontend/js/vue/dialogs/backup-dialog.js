import { ref } from "vue";
import { state, importBackup, notify } from "../store.js";
import { localDate } from "../../core/dates.js";
import { Icon } from "../components/icon.js";

export const BackupDialog = {
  components: { Icon },
  setup(_, { expose }) {
    const backupDialog = ref(null), importFile = ref(null);
    function exportBackup() {
      const contents =
        state.corruptLegacy ??
        JSON.stringify(
          {
            version: 5,
            transactions: state.transactions,
            customCategories: state.categories.map((name) => ({ name })),
          },
          null,
          2,
        );
      const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `meu-bolso-${localDate()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Backup baixado. Guarde essa cópia em um lugar seguro.");
    }
    async function handleImport(event) {
      const file = event.target.files[0];
      if (file && (await importBackup(file))) backupDialog.value.close();
      event.target.value = "";
    }
    expose({ open: () => backupDialog.value.showModal() });
    return { state, backupDialog, importFile, exportBackup, handleImport };
  },
  template: `<dialog id="backupDialog" ref="backupDialog">
  <div class="dialog-heading">
    <div>
      <p class="eyebrow">UMA CÓPIA PARA VOCÊ</p>
      <h2>Backup dos seus dados</h2>
    </div>
    <button
      class="icon-button"
      aria-label="Fechar backup"
      @click="backupDialog.close()"
    >
      <Icon name="close" />
    </button>
  </div>
  <p>
    Guarde uma cópia fora do serviço. O histórico automático mantém as
    últimas 30 versões no mesmo banco.
  </p>
  <button
    id="exportButton"
    class="backup-option"
    :disabled="!state.ready"
    @click="exportBackup"
  >
    <Icon name="download" /><span
      ><strong>Exportar dados</strong
      ><small>Baixar seus lançamentos em JSON</small></span
    ><Icon name="right" /></button
  ><button
    id="importButton"
    class="backup-option"
    :disabled="!state.ready || state.saving"
    @click="importFile.click()"
  >
    <Icon name="upload" /><span
      ><strong>Importar uma cópia</strong
      ><small>Adicionar registros sem duplicar os existentes</small></span
    ><Icon name="right" /></button
  ><input
    id="importFile"
    ref="importFile"
    type="file"
    accept="application/json,.json"
    hidden
    @change="handleImport"
  />
  <p class="field-hint">
    A importação combina os lançamentos pelo identificador. Registros que já
    existem são preservados.
  </p>
</dialog>`,
};
