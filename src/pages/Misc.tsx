import { Link } from 'react-router-dom'
import { Button, Empty } from '../lib/ui'

export function Restricted() {
  return <Empty icon="shield" title="You don’t have access to this area" text="This section is restricted. If you think you should have access, contact your organization administrator." action={<Link to="/"><Button variant="secondary">Back to dashboard</Button></Link>} />
}
export function NotFound() {
  return <Empty icon="search" title="Page not found" text="The page you’re looking for doesn’t exist or may have moved." action={<Link to="/"><Button variant="secondary">Back to dashboard</Button></Link>} />
}
