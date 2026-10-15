# Implantar o Meu bolso na Vercel

O projeto está preparado para Vercel Functions em Node.js, mantendo o mesmo banco Turso e o suporte ao Render. Não há banco SQLite nem diretório de dados na Vercel. O plano Hobby atende ao uso pessoal e não comercial, sujeito às condições e cotas atuais da Vercel.

## Configuração do projeto

1. No painel da Vercel, escolha **Add New → Project** e importe `oemersonsa/app-financas`.
2. Use a branch `main`. O **Root Directory** é a raiz do repositório: deixe em branco ou `.`. Não use `/workspace` nem o nome de uma pasta que só existe no ambiente de desenvolvimento.
3. Selecione **Framework Preset: Other**. O arquivo `vercel.json` já configura instalação com `npm ci`, build com `npm run build:vercel` e saída `vercel-public`.
4. Escolha Node.js 22.x ou uma versão superior compatível com `package.json` nas configurações do projeto.
5. Antes do deploy de produção, configure as variáveis abaixo em **Settings → Environment Variables**, no escopo **Production**. Não use o prefixo `VITE_` e não coloque valores privados no Git.
6. Faça o deploy. Depois de adicionar ou alterar variáveis, faça um novo deploy para que as Functions recebam a configuração.

| Variável | Valor a configurar |
| --- | --- |
| `TURSO_DATABASE_URL` | A mesma URL `libsql://...` do banco usado no Render |
| `TURSO_AUTH_TOKEN` | Token privado desse banco, com as permissões de leitura e escrita necessárias |
| `FINANCAS_USER` | O mesmo usuário proprietário configurado no Render; o padrão é `usuario` |
| `FINANCAS_PASSWORD` | A mesma senha do proprietário configurada no Render |

Não configure `HOST` ou `PORT`: a Vercel controla a execução da Function. Não é necessário iniciar `npm start` nem alterar os registros do banco. Todos os arquivos públicos do PWA e as páginas passam pela Function, preservando as verificações de acesso e os tipos MIME do servidor atual. O diretório de saída estática não contém páginas financeiras.

Para deploys de **Preview**, configure um banco Turso separado e credenciais de teste nesse escopo. As variáveis de Production não devem ser copiadas para testes que possam alterar finanças reais. Sem banco remoto e senha, a Function responde 503 e não cria um banco temporário.

## Dados e limites

Usando o mesmo banco Turso, usuários, senhas cadastradas, lançamentos, revisões, backups e sessões persistidas permanecem disponíveis. As tabelas existentes são mantidas; somente a tabela `financas_auth_limits` é criada para compartilhar o limite de tentativas entre instâncias e reinicializações.

O limite de autenticação é global por implantação/banco: até 30 falhas ou verificações simultâneas de login por janela de um minuto e até 10 tentativas de cadastro por minuto. Logins válidos liberam sua reserva. Render e Vercel compartilham esses limites se usarem o mesmo banco.

A Vercel impõe limites de payload às Functions. Esta configuração usa um teto conservador de **4 MiB** por requisição de estado e por resposta. A interface consulta o limite em `/api/session` e rejeita alterações ou importações cujo documento final ultrapasse esse tamanho antes de enviar. Uma base antiga maior que esse limite não pode ser consultada integralmente pela Function nesta versão; mantenha o acesso no Render para exportar e avaliar uma futura paginação. Nenhum dado do banco é excluído por esse limite. No Render e no desenvolvimento, o limite anterior de entrada de 10 MiB é preservado.

`maxDuration` está configurado como 30 segundos. Cotas, disponibilidade e duração efetiva dependem do plano e das configurações atuais da Vercel. Consultar e salvar finanças continua exigindo internet.

## Conferência após o deploy

- Abra `https://SEU-PROJETO.vercel.app/health`: deve responder `{"status":"ok"}`.
- Entre com o usuário proprietário e confira os registros existentes.
- Crie uma conta de teste e confirme que ela começa vazia. Registre, recarregue e confira o isolamento entre duas contas.
- Confira `/manifest.webmanifest`, `/sw.js` e `/icons/apple-touch-icon-v2.png`.
- No iPhone, abra a nova URL HTTPS no Safari e adicione novamente à tela de início. O PWA instalado no domínio do Render continua apontando para o endereço antigo.

O domínio muda, portanto o navegador poderá pedir login novamente e as preferências locais, como o tema, não são transferidas automaticamente. Conclua a conferência da nova URL antes de desativar o serviço no Render.

## Desenvolvimento

`npm start` e `npm run preview` continuam executando o servidor tradicional. `npm run build:vercel` compila o frontend, gera o service worker e prepara a saída estática vazia. Os testes de `tests/serverless.test.js` exercitam a entrada da Function com bancos temporários: inicialização concorrente, JSON previamente interpretado, isolamento de contas, limites, cookies e recursos PWA. Isso não substitui a conferência do deploy real no painel da Vercel.
