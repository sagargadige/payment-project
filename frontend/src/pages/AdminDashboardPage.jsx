import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Table, Spinner, Button, Tabs, Tab, Badge, Modal, Form,
} from 'react-bootstrap';
import api, { adminApi } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { formatMoney, formatDate, shortId } from '../utils/format.js';

/**
 * Admin dashboard:
 *  - summary stats
 *  - view payments
 *  - view refunds (approve/execute)
 *  - track failed payments
 *  - cancel orders
 *  - download CSV reports
 */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, r, f] = await Promise.all([
        adminApi.stats(),
        adminApi.payments(),
        adminApi.refunds(),
        adminApi.failedPayments(),
      ]);
      setStats(s);
      setPayments(p);
      setRefunds(r);
      setFailed(f);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const cancelOrder = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    setBusyId(id);
    try {
      await adminApi.cancelOrder(id, 'Cancelled by admin');
      setNotice('Order cancelled.');
      await loadAll();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  const openRefund = (order) => {
    setRefundTarget(order);
    setRefundAmount((order.amount / 100).toFixed(2));
    setRefundReason(order.refundReason || 'Refunded by admin');
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    setBusyId(refundTarget._id);
    try {
      const amountCents = Math.round(Number(refundAmount) * 100);
      await adminApi.refundOrder(refundTarget._id, {
        amountCents: amountCents > 0 ? amountCents : undefined,
        reason: refundReason,
      });
      setNotice('Refund executed via PayPal.');
      setRefundTarget(null);
      await loadAll();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  // CSV downloads need the auth header, so fetch as a blob and save it.
  const downloadReport = async (kind) => {
    try {
      const res = await api.get(`/api/admin/reports/${kind}.csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}-report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  const c = stats?.counts || {};

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold mb-0">Admin Dashboard</h3>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => downloadReport('payments')}>
            ⬇ Payments CSV
          </Button>
          <Button size="sm" variant="outline-primary" onClick={() => downloadReport('refunds')}>
            ⬇ Refunds CSV
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={loadAll}>Refresh</Button>
        </div>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />
      {notice && <div className="alert alert-success">{notice}</div>}

      <Row className="g-3 mb-4">
        <StatCard label="Total Orders" value={c.total ?? 0} />
        <StatCard label="Paid" value={c.success ?? 0} variant="success" />
        <StatCard label="Failed" value={c.failed ?? 0} variant="danger" />
        <StatCard label="Refunded" value={c.refunded ?? 0} variant="dark" />
        <StatCard
          label="Gross Revenue"
          value={formatMoney(stats?.grossRevenueCents || 0)}
          variant="primary"
        />
      </Row>

      <Tabs defaultActiveKey="payments" className="mb-3">
        <Tab eventKey="payments" title={`Payments (${payments.length})`}>
          <Card className="shadow-sm border-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Course</th><th>Amount</th>
                  <th>Status</th><th>Access</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((o) => (
                  <tr key={o._id}>
                    <td className="fw-semibold">{shortId(o._id)}</td>
                    <td>
                      <div>{o.customer?.name || '—'}</div>
                      <div className="text-muted small">{o.customer?.email}</div>
                    </td>
                    <td>{o.courseTitle}</td>
                    <td>{formatMoney(o.amount, o.currency)}</td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td>
                      <Badge bg={o.courseAccess === 'YES' ? 'success' : 'secondary'}>
                        {o.courseAccess}
                      </Badge>
                    </td>
                    <td className="text-muted small">{formatDate(o.createdAt)}</td>
                    <td className="text-end">
                      {o.paymentStatus === 'SUCCESS' && o.refundStatus !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="me-1"
                          disabled={busyId === o._id}
                          onClick={() => openRefund(o)}
                        >
                          Refund
                        </Button>
                      )}
                      {o.paymentStatus !== 'SUCCESS' && o.paymentStatus !== 'CANCELLED' && (
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          disabled={busyId === o._id}
                          onClick={() => cancelOrder(o._id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No payments yet.</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Tab>

        <Tab eventKey="refunds" title={`Refunds (${refunds.length})`}>
          <Card className="shadow-sm border-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Amount</th><th>Refund Status</th>
                  <th>Refund ID</th><th>Reason</th><th></th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((o) => (
                  <tr key={o._id}>
                    <td className="fw-semibold">{shortId(o._id)}</td>
                    <td>{o.customer?.email || '—'}</td>
                    <td>{formatMoney(o.amount, o.currency)}</td>
                    <td><Badge bg={o.refundStatus === 'COMPLETED' ? 'dark' : 'warning'}>{o.refundStatus}</Badge></td>
                    <td className="small">{o.refundId || '—'}</td>
                    <td className="small text-muted">{o.refundReason || '—'}</td>
                    <td className="text-end">
                      {o.refundStatus !== 'COMPLETED' && (
                        <Button size="sm" variant="danger" onClick={() => openRefund(o)}>
                          Approve & Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {refunds.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-4">No refunds.</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Tab>

        <Tab eventKey="failed" title={`Failed Payments (${failed.length})`}>
          <Card className="shadow-sm border-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Course</th><th>Amount</th><th>Reason</th><th>Date</th></tr>
              </thead>
              <tbody>
                {failed.map((o) => (
                  <tr key={o._id}>
                    <td className="fw-semibold">{shortId(o._id)}</td>
                    <td>{o.customer?.email || '—'}</td>
                    <td>{o.courseTitle}</td>
                    <td>{formatMoney(o.amount, o.currency)}</td>
                    <td className="small text-danger">{o.failureReason || '—'}</td>
                    <td className="text-muted small">{formatDate(o.updatedAt)}</td>
                  </tr>
                ))}
                {failed.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No failed payments.</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Tab>
      </Tabs>

      <Modal show={Boolean(refundTarget)} onHide={() => setRefundTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Execute Refund</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {refundTarget && (
            <>
              <p className="small text-muted">
                Order <strong>{shortId(refundTarget._id)}</strong> — {refundTarget.courseTitle}
                <br />Paid: {formatMoney(refundTarget.amount, refundTarget.currency)}
              </p>
              <Form.Group className="mb-3">
                <Form.Label>Refund amount ({refundTarget.currency})</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
                <Form.Text className="text-muted">
                  Leave the full amount for a complete refund.
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Label>Reason</Form.Label>
                <Form.Control
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setRefundTarget(null)}>Cancel</Button>
          <Button variant="danger" disabled={busyId} onClick={submitRefund}>
            {busyId ? 'Processing…' : 'Refund via PayPal'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function StatCard({ label, value, variant = 'light' }) {
  return (
    <Col xs={6} md={4} lg={2}>
      <Card className={`stat-card text-center p-3 bg-${variant} ${variant === 'light' ? '' : 'text-white'}`}>
        <div className="small opacity-75">{label}</div>
        <div className="fs-4 fw-bold">{value}</div>
      </Card>
    </Col>
  );
}
