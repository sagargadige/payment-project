import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext.jsx';

export default function NavBar({ paypalMode }) {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Navbar bg="white" expand="lg" className="shadow-sm" sticky="top">
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
          <span role="img" aria-label="cart">🛒</span> Course Store
          <Badge bg={paypalMode === 'live' ? 'danger' : 'secondary'} className="ms-1">
            {paypalMode === 'live' ? 'LIVE' : 'SANDBOX'}
          </Badge>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto align-items-lg-center gap-lg-2">
            <Nav.Link as={NavLink} to="/" end>
              Courses
            </Nav.Link>
            {isAuthenticated && (
              <Nav.Link as={NavLink} to="/orders">
                My Orders
              </Nav.Link>
            )}
            {isAdmin && (
              <Nav.Link as={NavLink} to="/admin">
                Admin
              </Nav.Link>
            )}
            {isAuthenticated ? (
              <>
                <span className="text-muted small d-none d-lg-inline">
                  {user?.name}
                </span>
                <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/login">
                  Login
                </Nav.Link>
                <Button as={Link} to="/register" variant="primary" size="sm">
                  Sign up
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
