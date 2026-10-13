import { open } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const serverArgs = process.argv.slice(2);
const portIndex = serverArgs.indexOf('--port');
const port = Number(portIndex >= 0 ? serverArgs[portIndex + 1] : process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Escolha uma porta válida, de 0 a 65535.');
  process.exit(1);
}
const available = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
  probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
});
if (!available) {
  let existingPreview = false;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/login.html`, { signal: AbortSignal.timeout(3000) });
    const html = await response.text();
    existingPreview = response.ok && /<title>(Meu bolso|Entrar — Meu bolso)/.test(html);
  } catch { /* Another service may be using this port. */ }
  if (existingPreview) {
    console.log(`O Meu bolso já está rodando em http://localhost:${port}/. Abra ou recarregue o navegador.`);
    console.log('Use as credenciais já configuradas; para a prévia local, consulte .env.preview.');
    process.exit(0);
  }
  console.error(`A porta ${port} está ocupada por outro serviço. Use npm run preview -- --port ${port === 65535 ? 8001 : port + 1}.`);
  process.exit(1);
}

// Preview must listen beyond loopback; keep the application's login protection.
const environmentFile = '.env.preview';
const args = [];
if (!process.env.FINANCAS_PASSWORD) {
  try {
    const file = await open(environmentFile, 'wx', 0o600);
    try {
      await file.writeFile(`FINANCAS_USER=usuario\nFINANCAS_PASSWORD=${randomBytes(18).toString('base64url')}\n`);
    } finally { await file.close(); }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  args.push(`--env-file=${environmentFile}`);
  console.log(`Credenciais de acesso local em ${environmentFile} (arquivo privado, fora do Git).`);
} else {
  console.log('A prévia usa as credenciais já configuradas no ambiente.');
}
const server = spawn(process.execPath, [...args, 'server.js', ...serverArgs], {
  stdio: 'inherit', env: { ...process.env, HOST: '0.0.0.0', NODE_ENV: 'development' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.on('exit', code => { process.exitCode = code ?? 0; });
