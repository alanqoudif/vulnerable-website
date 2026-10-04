import { useApi } from '../lib/api'
import { Card, ErrorState, Loading, PageHeader, Table, Td } from '../lib/ui'
import { date } from '../lib/format'

export default function AdminConsole() {
  const { data, error, loading, reload } = useApi<{ organizations: any[] }>('/admin')
  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Organizations on this deployment." />
      <Card><Table head={['Organization', 'Plan', 'Created']}>
        {data?.organizations.map(o => <tr key={o.id}><Td>{o.name}</Td><Td>{o.plan}</Td><Td>{date(o.created_at)}</Td></tr>)}
      </Table></Card>
    </>
  )
}
