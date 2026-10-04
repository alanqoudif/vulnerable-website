// Local stand-in for Netlify Functions (same handler). Run: npm run dev:api
import { createServer } from 'node:http'
try { process.loadEnvFile('.env') } catch { /* env may be provided by the shell */ }

const { handle } = await import('../netlify/functions/api')

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const ch of req) chunks.push(ch as Buffer)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const r = await handle(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body }))
  res.writeHead(r.status, Object.fromEntries(r.headers.entries()))
  res.end(Buffer.from(await r.arrayBuffer()))
}).listen(8888, () => console.log('local api on http://localhost:8888'))
