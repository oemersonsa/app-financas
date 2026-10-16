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

## Vercel + Turso

O projeto também pode ser implantado como Vercel Functions. Importe este repositório com preset **Other**, mantenha a raiz do repositório e configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `FINANCAS_USER` e `FINANCAS_PASSWORD` no painel. `vercel.json` define o build e as rotas; não use `npm start` na Vercel. A função exige banco remoto e preserva os dados ao apontar para o mesmo Turso.

Consulte [docs/vercel.md](docs/vercel.md) para as etapas, configuração de Production/Preview, validação no iPhone e limite de payload de 4 MiB. A configuração anterior do Render continua disponível.

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
| `FINANCAS_USER` | Usuário proprietário original; padrão `usuario` |
| `FINANCAS_PASSWORD` | Senha privada do proprietário original |

Em produção, a inicialização exige Turso e senha. Uma configuração ausente impede a inicialização, evitando gravar finanças no disco temporário da hospedagem. As tabelas são criadas automaticamente como `financas_state` e `financas_backups`.

O Blueprint indica o plano gratuito do Render. Esse plano pode suspender o serviço quando ocioso e demorar no primeiro acesso; confira as condições e limites atuais de Render e Turso. O banco remoto preserva os dados durante reinícios do serviço. GitHub Pages e um servidor somente estático não executam esta API.

## Interface Vue

O painel usa Vue 3 com componentes para lançamentos, resumo, gráfico de categorias, entradas e despesas do ano e vencimentos pendentes do mês. Os valores vêm da API: nenhum registro de demonstração é inserido. No celular, o saldo aparece primeiro e a navegação fica na parte inferior. O seletor de mês, os filtros e a busca controlam os lançamentos exibidos.

## Instalar no iPhone como PWA

1. Abra a URL HTTPS do Render no Safari e aguarde o primeiro carregamento online.
2. Toque em Compartilhar → Adicionar à Tela de Início → Adicionar.
3. Abra o ícone **Meu bolso** na tela inicial. O aplicativo abre sem a barra do Safari; entre novamente se o iPhone solicitar login.

O ícone e o nome também estão disponíveis na tela de login. Em navegadores compatíveis com instalação por botão, aparece **Instalar app** no rodapé. No iPhone, o rodapé explica o caminho pelo menu Compartilhar.

Esta primeira versão exige internet para consultar e salvar finanças. Após o primeiro acesso online, o service worker oferece uma tela de indisponibilidade caso o servidor não possa ser alcançado. **Tentar novamente** retorna à aplicação quando a conexão for restabelecida. Não há fila de lançamentos offline.

Somente arquivos públicos de instalação e da tela sem conexão entram no cache: lançamentos, respostas da API, páginas autenticadas e o bundle do painel não são armazenados pelo service worker. O cache recebe uma versão calculada a partir do conteúdo durante `npm run build`; atualizações removem versões antigas desse cache sem limpar outros dados do navegador. HTTPS é necessário na hospedagem; localhost funciona para desenvolvimento. A instalação final e as áreas seguras devem ser conferidas em um iPhone real.

## Tema claro e escuro

O seletor Tema em Configurações (ou Conta, no celular) e na tela de login oferece Sistema, Claro e Escuro. Sistema acompanha a preferência do dispositivo; uma escolha manual fica salva somente neste navegador e é sincronizada entre abas. O tema é aplicado antes de carregar a interface e adapta gráficos, formulários e diálogos.

## Lançamentos

- Despesa comum: informe descrição, valor, data, categoria e se já foi paga.
- Conta fixa: escolha a programação mensal. As próximas ocorrências são criadas ao navegar pelos meses, inicialmente pendentes, preservando o dia original após meses curtos. Excluir uma ocorrência mantém as demais.
- Compra parcelada: informe o valor total e a quantidade de parcelas (2 a 360). O total é distribuído em centavos, sem erro de arredondamento. A página Parcelas mostra pagamentos, valores pagos e restantes; permite marcar ou editar uma parcela. Excluir o parcelamento remove todo o grupo após confirmação.
- Entradas: registre salário e outras receitas. O resumo acompanha entradas, despesas e saldo do mês selecionado.

Categorias principais: Moradia, Alimentação, Assinaturas, Lazer, Pensão, Dívidas de cartão e Empréstimos. Também é possível criar categorias.

## Acesso, cadastro e sessão

A tela de acesso oferece **Entrar** e **Criar conta**. O cadastro pede nome, usuário (3 a 40 letras, números, pontos, traços ou sublinhados), senha (10 a 128 caracteres) e confirmação. Cada nova conta começa vazia e tem lançamentos, categorias, revisões e histórico de backup próprios. Usuários são normalizados para minúsculas; nomes de usuário não podem se repetir. Senhas cadastradas são armazenadas com scrypt e salt aleatório, nunca em texto puro.

O usuário proprietário configurado por `FINANCAS_USER` e `FINANCAS_PASSWORD` continua entrando normalmente e mantém os lançamentos e backups existentes. As tabelas antigas não são substituídas nem copiadas para contas novas; o nome do proprietário fica reservado. Essas variáveis continuam obrigatórias em produção. Em desenvolvimento sem senha, o modo local permanece acessível apenas em loopback; contas cadastradas também podem ser testadas pela tela de login. Para expor a prévia, use `npm run preview`, que exige credenciais.

A opção **Manter conectado** mantém uma sessão de login por 30 dias; desmarcada, por um dia. Um novo cadastro inicia uma sessão de um dia. Sair revoga a sessão no servidor. As sessões de contas cadastradas ficam em `financas_user_sessions`; as do proprietário continuam em `financas_sessions`. Apenas hashes dos tokens são armazenados. O cookie é HttpOnly, SameSite=Lax e Secure em produção. Trocar as credenciais do proprietário invalida somente suas sessões; reinícios preservam sessões válidas.

Cadastros e tentativas de login são limitados por contadores persistidos no Turso, compartilhados entre instâncias. Não há recuperação de senha ou alteração de credenciais pela interface nesta versão. Os dados da API são selecionados pelo usuário autenticado, nunca por um identificador enviado no documento. O cabeçalho `X-Meu-Bolso-Account` confirma a conta esperada nas gravações de usuários cadastrados; uma aba antiga é recarregada quando a conta é trocada em outra aba. A migração automática de registros antigos do navegador permanece disponível somente para o proprietário/modo local, evitando importar dados de outra pessoa em um novo cadastro.

## Safari e ícone no iPhone

Campos de entrada, seletores e buscas usam pelo menos 16 px no celular, evitando o zoom automático do Safari ao focar. O zoom manual continua permitido. O apple-touch-icon explicita PNG de 180×180, com endereço atualizado e arquivos de compatibilidade na raiz. Após o deploy, se o iPhone ainda mostrar o ícone antigo ou genérico, remova o atalho instalado e adicione novamente pelo Safari; o iOS pode manter o ícone da instalação anterior.

## Salvamento e recuperação

A tela confirma salvamento somente após resposta do banco. Falha de rede mantém o formulário aberto. Revisões impedem que uma aba antiga sobrescreva dados de outro dispositivo.

Cada gravação mantém as últimas 30 versões em `financas_backups` para o proprietário ou em `financas_user_backups` por usuário cadastrado, na mesma transação dos registros. Falha ao gravar o histórico cancela a alteração. Para recuperar uma versão, consulte `revision`, `created_at` e `document` dessa tabela no Turso; salve o conteúdo de `document` como JSON. A importação pela interface combina lançamentos e preserva identificadores existentes; restaurar integralmente uma versão exige acesso administrativo ao banco e atualização do documento atual.

O menu Backup também exporta JSON para guardar fora do serviço. O histórico no mesmo banco ajuda a recuperar alterações, mas não protege contra exclusão do banco inteiro; mantenha exportações externas. Registros antigos no navegador são importados somente para o proprietário/modo local quando seu banco está vazio.

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
