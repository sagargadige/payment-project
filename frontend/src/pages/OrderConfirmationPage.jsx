import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Spinner, Button, Table, Badge, Modal, Form } from 'react-bootstrap';
import { orderApi, paymentApi } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { formatMoney, formatDate, shortId } from '../utils/format.js';

/**
 * Order confirmation / invoice screen.
 * Shows the full invoice and offers a refund request action for paid orders.
 */
export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = () => {
    setLoading(true);
    orderApi
      .get(orderId)
      .then(setOrder)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, [orderId]);

  const submitRefund = async () => {
    setRefundBusy(true);
    setError(null);
    try {
      const { order: updated } = await paymentApi.requestRefund(orderId, refundReason);
      setOrder(updated);
      setShowRefund(false);
      setNotice('Refund request submitted. An admin will review it shortly.');
    } catch (err) {
      setError(err);
    } finally {
      setRefundBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card className="p-4 text-center">
        <h5>Order not found</h5>
        <Link to="/orders" className="btn btn-primary mt-2">Back to orders</Link>
      </Card>
    );
  }

  const canRefund = order.paymentStatus === 'SUCCESS' && order.refundStatus === 'NONE';

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold mb-0">Order Confirmation</h3>
        <StatusBadge status={order.paymentStatus} />
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />
      {notice && <div className="alert alert-success">{notice}</div>}

      <Card className="invoice shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between flex-wrap mb-4">
            <div>
              <h5 className="fw-bold mb-0">Course Store</h5>
              <div className="text-muted small">Invoice / Receipt</div>
            </div>
            <div className="text-end">
              <div className="text-muted small">Invoice No.</div>
              <div className="fw-semibold">INV-{shortId(order._id)}</div>
              <div className="text-muted small mt-1">{formatDate(order.createdAt)}</div>
            </div>
          </div>

          <Table borderless size="sm">
            <tbody>
              <tr>
                <td className="text-muted">Order ID</td>
                <td className="text-end fw-semibold">{order._id}</td>
              </tr>
              <tr>
                <td className="text-muted">Course</td>
                <td className="text-end fw-semibold">{order.courseTitle}</td>
              </tr>
              <tr>
                <td className="text-muted">PayPal Order ID</td>
                <td className="text-end">{order.paypalOrderId || '—'}</td>
              </tr>
              <tr>
                <td className="text-muted">Capture ID</td>
                <td className="text-end">{order.captureId || '—'}</td>
              </tr>
              <tr>
                <td className="text-muted">Course Access</td>
                <td className="text-end">
                  <Badge bg={order.courseAccess === 'YES' ? 'success' : 'secondary'}>
                    {order.courseAccess}
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="text-muted">Refund Status</td>
                <td className="text-end">{order.refundStatus}</td>
              </tr>
            </tbody>
          </Table>

          <hr />
          <div className="d-flex justify-content-between">
            <strong>Total Paid</strong>
            <strong className="price-tag">{formatMoney(order.amount, order.currency)}</strong>
          </div>

          {order.failureReason && (
            <div className="alert alert-danger small mt-3 mb-0">
              <strong>Failure reason:</strong> {order.failureReason}
            </div>
          )}
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 mt-3">
        <Button variant="outline-secondary" as={Link} to="/orders">Back to Orders</Button>
        <Button variant="outline-primary" onClick={() => window.print()}>Print / Save PDF</Button>
        {canRefund && (
          <Button variant="danger" onClick={() => setShowRefund(true)}>Request Refund</Button>
        )}
      </div>

      <Modal show={showRefund} onHide={() => setShowRefund(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Request a Refund</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Tell us why you would like a refund for <strong>{order.courseTitle}</strong>.
          </p>
          <Form.Control
            as="textarea"
            rows={3}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Reason for refund…"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRefund(false)}>Cancel</Button>
          <Button variant="danger" disabled={refundBusy} onClick={submitRefund}>
            {refundBusy ? 'Submitting…' : 'Submit Request'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
