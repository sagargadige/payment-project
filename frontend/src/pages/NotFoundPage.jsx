import { Link } from 'react-router-dom';
import { Card, Button } from 'react-bootstrap';

export default function NotFoundPage() {
  return (
    <Card className="text-center p-5 shadow-sm border-0">
      <h1 className="display-4 fw-bold">404</h1>
      <p className="text-muted">The page you are looking for does not exist.</p>
      <div>
        <Button as={Link} to="/" variant="primary">Back to Courses</Button>
      </div>
    </Card>
  );
}
