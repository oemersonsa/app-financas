# Organização da aplicação

Frontend em Vue 3 com ES Modules; backend Node.js com HTTP nativo e cliente oficial libSQL. O esbuild compila Vue e os módulos em `frontend/build/app.js`, servido pela mesma aplicação. Não há dependência de CDN nem mudanças no formato do banco.

```text
app-financas/
├── server.js                  # Inicialização e encerramento
├── backend/                   # HTTP, autenticação, sessões e banco
├── frontend/
│   ├── index.html             # Ponto de montagem Vue
│   ├── login.html             # Login independente
│   ├── js/
│   │   ├── vue/
│   │   │   ├── app.js         # Navegação, painel, parcelas e diálogos
│   │   │   ├── components.js  # Linhas de lançamento e gráficos
│   │   │   ├── form.js        # Formulário e regras de edição
│   │   │   └── store.js       # Estado reativo, API, migração e backup
│   │   ├── core/             # Datas e formatação
│   │   └── domain/           # Regras financeiras puras compartilhadas
│   ├── build/                # Bundle gerado, ignorado pelo Git
│   └── styles/               # Interface Vue e login
├── tests/                    # Regras, banco, API e navegador
├── scripts/                  # Compilação e verificações
└── render.yaml               # Render com banco remoto Turso
```

## Responsabilidades

As regras em `domain/` recebem dados e retornam resultados, sem acessar tela, API ou estado global. O backend reutiliza a validação pura de lançamentos. O estado reativo e a persistência ficam em `vue/store.js`; componentes renderizam valores calculados, usando interpolação Vue para escapar descrições e categorias. Somente os ícones SVG definidos pelo projeto usam HTML direto.

`vue/form.js` reaproveita as regras de parcelamento e recorrência. Falhas mantêm o formulário aberto; revisões rejeitam gravações de abas antigas e atualizam os dados para permitir nova tentativa. Não há confirmação otimista de salvamento. O estado do banco permanece como `{revision, data: {version, transactions, customCategories}}`.

Os gráficos exibem os registros existentes, sem materializar contas fixas de meses não visitados. O gráfico anual apresenta entradas e despesas registradas por mês, com uma tabela acessível. Vencimentos mostram despesas pendentes do mês selecionado, incluindo atrasadas. A importação combina identificadores, sem sobrescrever registros existentes; não é uma restauração integral.

`http.js` limita requisições a 10 MB, valida origem e entrega exclusivamente arquivos do frontend. Sessões ficam no banco; `/health` informa somente disponibilidade. `database.js` grava documento e histórico em uma transação, com revisão para rejeitar sobrescritas concorrentes. Desenvolvimento usa SQLite; produção exige Turso.

`npm start` e `npm test` compilam o frontend automaticamente. `npm run build` pode ser executado separadamente e valida as expressões dos templates Vue antes de gerar o bundle. A entrada está em `js/app.js`; o navegador carrega somente o bundle gerado. As camadas de manipulação manual de HTML foram substituídas por componentes Vue.

## Evolução

Coloque cálculos em `domain/`, estilos de estrutura em `styles/vue.css` e superfícies de vidro em `styles/glass.css` e alterações de persistência no backend. Extraia responsabilidades quando um módulo começar a misturar assuntos; arquivos perto de 100–250 linhas são uma orientação, não uma regra absoluta. `npm run check` detecta sintaxe inválida, caminhos incorretos, ciclos e dependências da camada financeira na interface.

## Limites

Há um único conjunto de finanças por implantação, protegido por usuário, senha e sessão. A tela de login não fornece cadastro público ou recuperação de senha; as credenciais são administradas nas variáveis do Render. O cliente carrega dados ao abrir e detecta conflitos ao gravar; não há sincronização em tempo real nem contas separadas. O banco remoto permite reinícios sem perda de dados, mas a estrutura de documento único não foi projetada para um sistema de grande volume. Histórico no mesmo banco não substitui uma cópia externa.

## Superfícies de vidro

`styles/glass.css` acrescenta transparência, desfoque, saturação e reflexos às superfícies. Controles pequenos recebem reflexos de posição do mouse por `vue/glass.js`, limitados a uma atualização por frame. Os eventos e frames são removidos ao desmontar a interface. O movimento respeita `prefers-reduced-motion`; transparência reduzida e cores forçadas têm alternativas de CSS. Navegadores sem desfoque mantêm superfícies mais opacas. O efeito aproxima o visual do vidro sem simular refração óptica do fundo.

## Tema

`js/theme.js` é carregado antes do bundle para aplicar o tema sem clarão inicial e compartilhar a preferência entre painel e login. Somente a chave `meu-bolso-theme` é salva no navegador; dados financeiros continuam no banco. O modo Sistema acompanha `prefers-color-scheme`, e eventos de armazenamento atualizam as outras abas. `styles/theme.css` adapta a paleta e o `color-scheme` também cobre controles nativos. Esses dois arquivos são públicos para funcionar antes da autenticação.
