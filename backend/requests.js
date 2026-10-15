export function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host;
  } catch { return false; }
}
export async function readJson(req, limit = 10 * 1024 * 1024) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw Object.assign(new Error('Envie JSON.'), { status: 415 });
  // Vercel may already have consumed and parsed the incoming JSON stream.
  if (req.body !== undefined) {
    const raw = Buffer.isBuffer(req.body) ? req.body : typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body));
    if (raw.length > limit) throw Object.assign(new Error('Arquivo muito grande.'), { status: 413 });
    try { return JSON.parse(raw.toString('utf8')); }
    catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
  }
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw Object.assign(new Error('Arquivo muito grande.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}
