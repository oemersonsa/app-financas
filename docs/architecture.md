# Organização da aplicação

Frontend em JavaScript nativo com ES Modules; backend Node.js com HTTP nativo e cliente oficial libSQL. Não há bundler nem framework de interface.

```text
app-financas/
├── server.js                  # Configuração, inicialização e encerramento
├── backend/
│   ├── assets.js              # Arquivos públicos e URLs portáveis
│   ├── http.js                # Rotas, limites e arquivos públicos
│   ├── auth.js                # Autenticação
│   ├── validation.js          # Validação do documento completo
│   └── database.js            # Turso/SQLite, transações, revisões e histórico
├── frontend/
│   ├── index.html             # Estrutura das telas e formulários
│   ├── js/
│   │   ├── app.js             # Inicialização
│   │   ├── core/              # Estado, datas e formatação
│   │   ├── domain/            # Regras de despesas, parcelas e recorrência
│   │   ├── services/          # API, migração e persistência
│   │   ├── controllers/       # Eventos e ações
│   │   └── ui/                # Renderização e navegação
│   └── styles/                # Base, layout, componentes, telas e responsividade
├── tests/                     # Regras, banco, API e navegador
├── scripts/                   # Verificações de desenvolvimento
├── data/                      # Banco local privado, ignorado pelo Git
└── render.yaml                # Render com banco remoto Turso
```

## Responsabilidades

As regras em `domain/` recebem dados e retornam resultados, sem acessar tela, API ou estado global. Controladores traduzem eventos em ações; serviços coordenam gravação e erros; a interface apresenta resultados. O estado está em `core/state.js`. O backend reutiliza a validação pura de lançamentos.

`http.js` limita o corpo das requisições a 10 MB, valida origem e entrega exclusivamente arquivos do frontend. `auth.js` protege dados e arquivos; `/health` informa somente disponibilidade. `database.js` grava o documento e histórico em uma transação, com revisão para rejeitar sobrescritas concorrentes. `server.js` conecta essas responsabilidades.

O formato da API permanece `{revision, data: {version, transactions, customCategories}}`. A abordagem de documento único simplifica exportação e recuperação para uso pessoal. As tabelas têm prefixo `financas_`. O desenvolvimento usa SQLite pelo mesmo driver; produção exige Turso. A migração da antiga tabela `state` é permitida apenas em bancos locais.

## Evolução

Coloque cálculos em `domain/`, estilos no arquivo da respectiva área e alterações de persistência no backend. Extraia responsabilidades quando um módulo começar a misturar assuntos; arquivos perto de 100–250 linhas são uma orientação, não uma regra absoluta. `npm run check` detecta sintaxe inválida, caminhos incorretos, ciclos e dependências da camada financeira na interface.

## Limites

Há um único conjunto de finanças por implantação, protegido por usuário e senha. O cliente carrega dados ao abrir e detecta conflitos ao gravar; não há sincronização em tempo real nem contas separadas. O banco remoto permite reinícios sem perda de dados, mas a estrutura de documento único não foi projetada para um sistema de grande volume. Histórico no mesmo banco não substitui uma cópia externa.
