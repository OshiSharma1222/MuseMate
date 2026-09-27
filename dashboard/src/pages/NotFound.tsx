import { Link } from 'react-router'
import { Empty } from '../components/ui'

export default function NotFound() {
  return (
    <Empty title="Nothing here">
      That page does not exist.{' '}
      <Link to="/" className="text-accent underline-offset-2 hover:underline">
        Back to the overview
      </Link>
    </Empty>
  )
}
