import { Container } from 'react-bootstrap';

export default function Footer() {
  return (
    <footer className="footer py-3 mt-4">
      <Container className="d-flex flex-wrap justify-content-between align-items-center small text-muted">
        <span>PayPal Payment Gateway System — case-study demo</span>
        <span>React · Node/Express · MongoDB · PayPal REST API</span>
      </Container>
    </footer>
  );
}
