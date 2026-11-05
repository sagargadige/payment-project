import { Badge } from 'react-bootstrap';

const MAP = {
  CREATED: { bg: 'secondary', label: 'Created' },
  PENDING: { bg: 'info', label: 'Pending' },
  SUCCESS: { bg: 'success', label: 'Paid' },
  FAILED: { bg: 'danger', label: 'Failed' },
  CANCELLED: { bg: 'warning', label: 'Cancelled' },
  REFUNDED: { bg: 'dark', label: 'Refunded' },
};

export default function StatusBadge({ status }) {
  const cfg = MAP[status] || { bg: 'secondary', label: status };
  return <Badge bg={cfg.bg} className="status-badge">{cfg.label}</Badge>;
}
