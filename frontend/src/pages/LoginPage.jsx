import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (role) => {
    if (role === 'admin') {
      setEmail('admin@example.com');
      setPassword('admin123');
    } else {
      setEmail('student@example.com');
      setPassword('password123');
    }
  };

  return (
    <Row className="justify-content-center">
      <Col md={6} lg={5}>
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h3 className="fw-bold mb-3">Log in</h3>
            <ErrorAlert error={error} onClose={() => setError(null)} />
            <Form onSubmit={submit}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100" disabled={busy}>
                {busy ? 'Logging in…' : 'Log in'}
              </Button>
            </Form>

            <Alert variant="light" className="border small mt-3 mb-0">
              <div className="fw-semibold mb-1">Demo accounts (after <code>npm run seed</code>):</div>
              <div className="d-flex gap-2">
                <Button size="sm" variant="outline-secondary" onClick={() => fillDemo('student')}>
                  Student
                </Button>
                <Button size="sm" variant="outline-secondary" onClick={() => fillDemo('admin')}>
                  Admin
                </Button>
              </div>
            </Alert>

            <p className="text-center text-muted mt-3 mb-0">
              No account? <Link to="/register">Sign up</Link>
            </p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
