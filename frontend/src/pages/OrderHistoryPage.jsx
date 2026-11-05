import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Spinner, Button, Badge } from 'react-bootstrap';
import { orderApi } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { formatMoney, formatDate, shortId } from '../utils/format.js';

/** Order history — every order the logged-in user has placed. */
export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    orderApi
      .list()
      .then(setOrders)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      <h3 className="fw-bold mb-3">My Orders</h3>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      {orders.length === 0 ? (
        <Card className="text-center p-5">
          <h5>No orders yet</h5>
          <p className="text-muted">Your purchases will appear here.</p>
          <div>
            <Button as={Link} to="/" variant="primary">Browse Courses</Button>
          </div>
        </Card>
      ) : (
        <Card className="shadow-sm border-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Order</th>
                <th>Course</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td className="fw-semibold">{shortId(o._id)}</td>
                  <td>{o.courseTitle}</td>
                  <td className="text-muted small">{formatDate(o.createdAt)}</td>
                  <td>{formatMoney(o.amount, o.currency)}</td>
                  <td><StatusBadge status={o.paymentStatus} /></td>
                  <td>
                    <Badge bg={o.courseAccess === 'YES' ? 'success' : 'secondary'}>
                      {o.courseAccess}
                    </Badge>
                  </td>
                  <td className="text-end">
                    <Button as={Link} to={`/orders/${o._id}`} size="sm" variant="outline-primary">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
