export const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
export const dateTime = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-')
export const ago = (s?: string | null) => {
  if (!s) return '-'
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  if (m < 43200) return `${Math.round(m / 1440)}d ago`
  return date(s)
}
export const money = (n: number | string | null | undefined, cur = 'OMR') => (n === null || n === undefined ? '-' : `${cur} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
export const num = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('en-US')
export const bytes = (n?: number | null) => (!n ? '-' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
export const roleLabel = (r?: string | null) => ({ organization_admin: 'Administrator', manager: 'Manager', employee: 'Employee' } as Record<string, string>)[r ?? ''] ?? r ?? ''
export const initials = (n?: string) => (n ?? '?').split(' ').filter(w => w.toLowerCase() !== 'al').map(w => w[0]).slice(0, 2).join('').toUpperCase()
