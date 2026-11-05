import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Row, Col, Card, Button, Spinner, Alert, ListGroup } from 'react-bootstrap';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { courseApi, paymentApi } from '../api/client.js';
import { useConfig } from '../context/ConfigContext.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { formatMoney } from '../utils/format.js';

/**
 * Checkout page.
 *
 * Flow:
 *  1. Load the course (price shown is display-only — the backend re-reads it).
 *  2. createOrder()  -> POST /api/payments/create-order  -> returns paypalOrderId
 *  3. PayPal JS SDK renders the buttons with that order id.
 *  4. onApprove()    -> POST /api/payments/capture-order -> server verifies & persists
 *  5. onCancel()     -> POST /api/payments/cancel-order  -> order marked CANCELLED
 *  6. onError()      -> show failure state
 */
export default function CheckoutPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { paypalClientId, paypalMode } = useConfig();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | creating | ready | capturing | error
  const [internalOrderId, setInternalOrderId] = useState(null);
  const [paypalOrderId, setPaypalOrderId] = useState(null);

  // A stable idempotency key per checkout attempt (prevents duplicate orders on retry).
  const idempotencyKey = useRef(
    `chk-${courseId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    courseApi
      .get(courseId)
      .then(setCourse)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [courseId]);

  // Create the PayPal order on the backend as soon as the course is loaded.
  useEffect(() => {
    if (!course) return;
    let cancelled = false;
    setStatus('creating');
    paymentApi
      .createOrder(course._id, idempotencyKey.current)
      .then((data) => {
        if (cancelled) return;
        setInternalOrderId(data.orderId);
        setPaypalOrderId(data.paypalOrderId);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [course]);

  const handleApprove = async (data) => {
    setStatus('capturing');
    try {
      const result = await paymentApi.captureOrder(internalOrderId, data.orderID);
      navigate('/payment/result', {
        state: { outcome: 'success', order: result.order },
      });
    } catch (err) {
      navigate('/payment/result', {
        state: { outcome: 'failure', error: err, orderId: internalOrderId },
      });
    }
  };

  const handleCancel = async () => {
    try {
      if (internalOrderId) await paymentApi.cancelOrder(internalOrderId);
    } catch {
      /* ignore — we still show the cancel screen */
    }
    navigate('/payment/result', {
      state: { outcome: 'cancel', orderId: internalOrderId },
    });
  };

  const handleError = (err) => {
    setError({ code: 'PAYPAL_SDK_ERROR', message: err?.message || 'PayPal checkout error' });
    setStatus('error');
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!course) {
    return (
      <Card className="p-4 text-center">
        <h5>Course not found</h5>
        <Link to="/" className="btn btn-primary mt-2">Back to courses</Link>
      </Card>
    );
  }

  return (
    <Row className="g-4">
      <Col lg={7}>
        <Card className="shadow-sm border-0">
          <Card.Body>
            <h3 className="fw-bold mb-1">{course.title}</h3>
            <p className="text-muted">{course.description}</p>
            <ListGroup variant="flush" className="mt-3">
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Lifetime access</span><span>✅</span>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Certificate of completion</span><span>✅</span>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex justify-content-between">
                <span>Secure PayPal checkout</span><span>✅</span>
              </ListGroup.Item>
            </ListGroup>
          </Card.Body>
        </Card>
      </Col>

      <Col lg={5}>
        <Card className="shadow-sm border-0">
          <Card.Body>
            <h5 className="fw-bold">Order Summary</h5>
            <div className="d-flex justify-content-between my-3">
              <span className="text-muted">Course price</span>
              <span className="price-tag">{formatMoney(course.price, course.currency)}</span>
            </div>
            <hr />
            <div className="d-flex justify-content-between mb-3">
              <strong>Total</strong>
              <strong className="price-tag">{formatMoney(course.price, course.currency)}</strong>
            </div>

            <Alert variant="light" className="small border">
              Paying in <strong>{paypalMode}</strong> mode. The amount is verified on the server
              before your payment is captured.
            </Alert>

            <ErrorAlert error={error} onClose={() => setError(null)} />

            {status === 'creating' && (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" /> <span className="ms-2">Preparing checkout…</span>
              </div>
            )}

            {status === 'capturing' && (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" /> <span className="ms-2">Capturing payment…</span>
              </div>
            )}

            {status === 'ready' && paypalClientId && (
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect', label: 'paypal' }}
                createOrder={() => Promise.resolve(paypalOrderId)}
                onApprove={handleApprove}
                onCancel={handleCancel}
                onError={handleError}
              />
            )}

            {status === 'ready' && !paypalClientId && (
              <Alert variant="warning" className="small">
                PayPal Client ID is not configured. Add <code>PAYPAL_CLIENT_ID</code> to
                <code> backend/.env</code> and restart the backend.
              </Alert>
            )}

            <Button variant="link" className="w-100 mt-2 text-muted" onClick={handleCancel}>
              Cancel and go back
            </Button>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
