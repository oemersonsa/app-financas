import { Icon } from "./icon.js";

export const PageFooter = {
  components: { Icon },
  template: `<footer class="page-footer">
  <button id="installApp" type="button" hidden>Instalar app</button>
  <p id="installHint" class="install-hint" hidden>No iPhone, use Compartilhar → Adicionar à Tela de Início.</p>
  <Icon name="lock" /><span
    >Seus registros ficam no banco. Seu controle fica com você.</span
  >
</footer>`,
};
