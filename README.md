# Meu bolso

Aplicação web de finanças pessoais, com visual inspirado em Liquid Glass, para celular e computador. Acompanhe despesas, entradas, saldo, contas fixas e compras parceladas. Os registros ficam no banco de dados, sem depender do cache do navegador.

## Executar localmente

Requer Node.js 22 ou superior:

```sh
npm ci
npm start
```

O comando `npm start` compila os componentes Vue antes de iniciar o servidor. Para compilar separadamente, execute `npm run build`. Vue e os arquivos da aplicação são servidos localmente, sem depender de CDN no navegador.

Acesse `http://localhost:8000` no seu computador. No desenvolvimento, o cliente oficial `@libsql/client` usa SQLite em `data/meu-bolso.sqlite3`. Reiniciar o servidor e limpar o navegador preservam os registros. Use `node server.js --port 8001 --data-dir /caminho/dados` para alterar porta ou diretório.

O banco local da versão Python é migrado automaticamente, preservando os registros e o arquivo original. Não execute os dois servidores simultaneamente sobre o mesmo banco. Para levar registros locais ao Turso, exporte um JSON pelo menu Backup na aplicação local e importe na aplicação hospedada. A importação adiciona lançamentos pelo identificador, sem duplicar nem sobrescrever os existentes.

## Prévia no navegador integrado

Em ambientes cloud, execute `npm run preview` na pasta do projeto. Esse comando compila a interface e escuta em `0.0.0.0:8000`, permitindo acesso pelo navegador integrado. O login permanece obrigatório: quando não há senha configurada, credenciais aleatórias são criadas em `.env.preview`, arquivo privado ignorado pelo Git. Consulte esse arquivo localmente para entrar. A prévia usa o mesmo banco local e não altera a configuração de produção. Se já estiver rodando, o comando informa o endereço e encerra sem iniciar outra instância. Para outra porta, use `npm run preview -- --port 8001`.

## Render + Turso

A configuração segue o padrão de `oemersonsa/dashboard`: Node.js no Render e `@libsql/client` conectado ao Turso. Nenhum disco persistente é necessário no Render.

1. Crie um banco no Turso para as finanças. Recomenda-se um banco separado do dashboard.
2. Obtenha a URL `libsql://...` e um token do banco no painel do Turso.
3. No Render, conecte este repositório usando o Blueprint `render.yaml`, ou crie um Web Service com build `npm ci && npm run build && npm run check && npm test`, início `npm start` e health check `/health`.
4. Configure as variáveis abaixo no painel do Render. Guarde token e senha apenas nos campos de ambiente privados, nunca no Git ou no chat.
5. Após a implantação, acesse a URL HTTPS fornecida pelo Render, entre pela tela de login e confirme um lançamento após recarregar e em outro navegador.

| Variável | Configuração |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Fornecida automaticamente pelo Render |
| `TURSO_DATABASE_URL` | URL `libsql://...` do banco de finanças |
| `TURSO_AUTH_TOKEN` | Token privado do banco |
| `FINANCAS_USER` | Usuário de acesso; padrão `usuario` |
| `FINANCAS_PASSWORD` | Senha privada para acessar a aplicação |

Em produção, a inicialização exige Turso e senha. Uma configuração ausente impede a inicialização, evitando gravar finanças no disco temporário da hospedagem. As tabelas são criadas automaticamente como `financas_state` e `financas_backups`.

O Blueprint indica o plano gratuito do Render. Esse plano pode suspender o serviço quando ocioso e demorar no primeiro acesso; confira as condições e limites atuais de Render e Turso. O banco remoto preserva os dados durante reinícios do serviço. GitHub Pages e um servidor somente estático não executam esta API.

## Interface Vue

O painel usa Vue 3 com componentes para lançamentos, resumo, gráfico de categorias, entradas e despesas do ano e vencimentos pendentes do mês. Os valores vêm da API: nenhum registro de demonstração é inserido. No celular, o saldo aparece primeiro e a navegação fica na parte inferior. O seletor de mês, os filtros e a busca controlam os lançamentos exibidos.

## Lançamentos

- Despesa comum: informe descrição, valor, data, categoria e se já foi paga.
- Conta fixa: escolha a programação mensal. As próximas ocorrências são criadas ao navegar pelos meses, inicialmente pendentes, preservando o dia original após meses curtos. Excluir uma ocorrência mantém as demais.
- Compra parcelada: informe o valor total e a quantidade de parcelas (2 a 360). O total é distribuído em centavos, sem erro de arredondamento. A página Parcelas mostra pagamentos, valores pagos e restantes; permite marcar ou editar uma parcela. Excluir o parcelamento remove todo o grupo após confirmação.
- Entradas: registre salário e outras receitas. O resumo acompanha entradas, despesas e saldo do mês selecionado.

Categorias principais: Moradia, Alimentação, Assinaturas, Lazer, Pensão, Dívidas de cartão e Empréstimos. Também é possível criar categorias.

## Acesso e sessão

Entre pela tela de login usando `FINANCAS_USER` e `FINANCAS_PASSWORD` configurados no Render. Não há cadastro público. A opção "Manter conectado" mantém o acesso por 30 dias; desmarcada, por um dia. O botão Sair encerra a sessão. Senha incorreta aparece como mensagem no formulário, sem janela de autenticação do navegador.

As sessões persistem no Turso em `financas_sessions`; apenas o hash do token é armazenado no banco. O cookie é HttpOnly, SameSite=Lax e Secure em produção. Trocar usuário ou senha invalida as sessões anteriores. Reiniciar ou atualizar o serviço preserva sessões válidas. Tentativas repetidas de login são limitadas por instância.

A senha de acesso continua obrigatória em produção. Não é necessário criar outra variável nem configurar tabelas manualmente para a nova tela.

## Salvamento e recuperação

A tela confirma salvamento somente após resposta do banco. Falha de rede mantém o formulário aberto. Revisões impedem que uma aba antiga sobrescreva dados de outro dispositivo.

Cada gravação mantém as últimas 30 versões em `financas_backups`, na mesma transação dos registros. Falha ao gravar o histórico cancela a alteração. Para recuperar uma versão, consulte `revision`, `created_at` e `document` dessa tabela no Turso; salve o conteúdo de `document` como JSON. A importação pela interface combina lançamentos e preserva identificadores existentes; restaurar integralmente uma versão exige acesso administrativo ao banco e atualização do documento atual.

O menu Backup também exporta JSON para guardar fora do serviço. O histórico no mesmo banco ajuda a recuperar alterações, mas não protege contra exclusão do banco inteiro; mantenha exportações externas. Registros antigos no navegador são importados quando o banco está vazio.

## Desenvolvimento e testes

```sh
npm run check
npm test
```

Os testes cobrem regras financeiras, API, banco, transações, concorrência, autenticação e migração local. A checagem verifica módulos, importações, ciclos e isolamento das regras. Para a integração com navegador, instale Playwright Python e Chromium e execute:

```sh
python3 -m unittest discover -s tests -p browser_smoke.py -v
```

Esse teste usa `/usr/bin/chromium` e bancos temporários. A execução local exercita o driver oficial com banco em arquivo; validar o banco Turso remoto requer suas variáveis de ambiente.

Consulte [docs/architecture.md](docs/architecture.md) para a organização e limites da aplicação.
