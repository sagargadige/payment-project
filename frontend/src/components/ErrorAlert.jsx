import { Alert } from 'react-bootstrap';

/** Consistent inline error display across all pages. */
export default function ErrorAlert({ error, onClose }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  const code = typeof error === 'object' ? error.code : null;

  return (
    <Alert variant="danger" dismissible={Boolean(onClose)} onClose={onClose}>
      <strong>Error:</strong> {message}
      {code && <span className="text-muted small ms-2">({code})</span>}
    </Alert>
  );
}
