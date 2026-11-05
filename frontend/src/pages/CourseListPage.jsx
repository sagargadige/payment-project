import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Spinner, Badge } from 'react-bootstrap';
import { courseApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { formatMoney } from '../utils/format.js';

export default function CourseListPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    courseApi
      .list()
      .then(setCourses)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const handleBuyNow = (courseId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/checkout/${courseId}` } } });
      return;
    }
    navigate(`/checkout/${courseId}`);
  };

  return (
    <>
      <div className="hero mb-4">
        <h1 className="fw-bold mb-2">Learn. Build. Get Certified.</h1>
        <p className="mb-0 opacity-75">
          Browse our courses and pay securely with PayPal. Instant access after payment.
        </p>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : courses.length === 0 ? (
        <Card className="text-center p-5">
          <h5>No courses available</h5>
          <p className="text-muted mb-0">
            Run <code>npm run seed</code> in the backend to load sample courses.
          </p>
        </Card>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-4">
          {courses.map((course) => (
            <Col key={course._id}>
              <Card className="course-card shadow-sm">
                {course.imageUrl && (
                  <Card.Img
                    variant="top"
                    src={course.imageUrl}
                    alt={course.title}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <Card.Body className="d-flex flex-column">
                  <Card.Title className="fw-semibold">{course.title}</Card.Title>
                  <Card.Text className="text-muted small flex-grow-1">
                    {course.description}
                  </Card.Text>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <span className="price-tag">{formatMoney(course.price, course.currency)}</span>
                    <Badge bg="light" text="dark" className="border">
                      {course.currency}
                    </Badge>
                  </div>
                  <Button
                    variant="primary"
                    className="mt-3 w-100"
                    onClick={() => handleBuyNow(course._id)}
                  >
                    Buy Now
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {!isAuthenticated && (
        <p className="text-center text-muted mt-4">
          <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to buy a course.
        </p>
      )}
    </>
  );
}
