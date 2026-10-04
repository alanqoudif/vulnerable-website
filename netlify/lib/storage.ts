import { db } from './core'

/** Minimal valid single-page PDF carrying synthetic text. */
export function tinyPdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, m => '\\' + m)
  const stream = 'BT /F1 12 Tf 50 780 Td 16 TL ' + lines.map(l => `(${esc(l)}) Tj T*`).join(' ') + ' ET'
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offs: number[] = []
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out)
}

export function syntheticContent(file: { name: string; mime_type: string | null; path: string }, extra?: string): { body: Buffer; type: string } {
  const lines = [`Synthetic training file: ${file.name}`, 'All content is fictional and generated for the Nuqta Workspace training environment.', extra ?? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.']
  if (file.name.endsWith('.csv')) {
    return { type: 'text/csv', body: Buffer.from('employee,department,amount_omr\nSynthetic Person A,Operations,1200\nSynthetic Person B,Finance,1450\nSynthetic Person C,Sales,980\n') }
  }
  if (file.mime_type === 'application/pdf') return { type: 'application/pdf', body: tinyPdf(lines) }
  return { type: file.mime_type || 'text/plain', body: Buffer.from(lines.join('\n\n') + '\n') }
}

/** Uploads placeholder content for every seeded `files` row. Safe to re-run. */
export async function seedStorage(): Promise<number> {
  const { data: files } = await db().from('files').select('id,bucket,path,name,mime_type,org_id')
  let n = 0
  for (const f of files ?? []) {
    const { data: doc } = await db().from('documents').select('body').eq('file_id', f.id).maybeSingle()
    const { body, type } = syntheticContent(f as any, doc?.body ?? undefined)
    const { error } = await db().storage.from(f.bucket).upload(f.path, body, { contentType: type, upsert: true })
    if (!error) n++
  }
  return n
}

/** Removes every object that is referenced by a `files` row (used before a reset). */
export async function purgeStorage() {
  const { data: files } = await db().from('files').select('bucket,path')
  const by: Record<string, string[]> = {}
  for (const f of files ?? []) (by[f.bucket] ||= []).push(f.path)
  for (const [bucket, paths] of Object.entries(by)) {
    for (let i = 0; i < paths.length; i += 100) await db().storage.from(bucket).remove(paths.slice(i, i + 100))
  }
}
