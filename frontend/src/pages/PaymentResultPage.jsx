import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col } from 'react-bootstrap';
import { formatMoney, shortId } from '../utils/format.js';

/**
 * Payment result screen — three clear states:
 *   success  -> green check, link to invoice
 *   failure  -> red cross, retry option
 *   cancel   -> amber, back to courses
 */
export default function PaymentResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const outcome = state?.outcome || 'failure';
  const order = state?.order;
  const error = state?.error;

  const config = {
    success: {
      icon: '✅',
      title: 'Payment Successful',
      variant: 'success',
      text: 'Your payment was captured and verified. You now have full access to the course.',
    },
    failure: {
      icon: '❌',
      title: 'Payment Failed',
      variant: 'danger',
      text: 'We could not complete your payment. No money was taken. You can try again.',
    },
    cancel: {
      icon: '⚠️',
      title: 'Payment Cancelled',
      variant: 'warning',
      text: 'You cancelled the checkout. Your order was not charged.',
    },
  }[outcome] || {};

  return (
    <Row className="justify-content-center">
      <Col md={8} lg={6}>
        <Card className="shadow-sm border-0 text-center p-4">
          <div className="result-icon mb-2">{config.icon}</div>
          <h3 className={`fw-bold text-${config.variant}`}>{config.title}</h3>
          <p className="text-muted">{config.text}</p>

          {outcome === 'success' && order && (
            <div className="text-start bg-light rounded p-3 my-3">
              <div className="d-flex justify-content-between">
                <span className="text-muted">Order ID</span>
                <span className="fw-semibold">{shortId(order._id)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Course</span>
                <span className="fw-semibold">{order.courseTitle}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Amount paid</span>
                <span className="fw-semibold">{formatMoney(order.amount, order.currency)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Capture ID</span>
                <span className="fw-semibold">{order.captureId || '—'}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Course access</span>
                <span className="fw-semibold text-success">{order.courseAccess}</span>
              </div>
            </div>
          )}

          {outcome === 'failure' && error && (
            <div className="alert alert-danger text-start small">
              <strong>{error.code || 'ERROR'}:</strong> {error.message}
            </div>
          )}

          <div className="d-flex gap-2 justify-content-center mt-2">
            {outcome === 'success' && order && (
              <Button variant="primary" onClick={() => navigate(`/orders/${order._id}`)}>
                View Invoice
              </Button>
            )}
            {outcome === 'failure' && (
              <Button variant="primary" onClick={() => navigate(-1)}>
                Try Again
              </Button>
            )}
            <Button variant="outline-secondary" as={Link} to="/orders">
              My Orders
            </Button>
            <Button variant="outline-secondary" as={Link} to="/">
              Browse Courses
            </Button>
          </div>
        </Card>
      </Col>
    </Row>
  );
}
