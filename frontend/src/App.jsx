import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Container, Spinner } from 'react-bootstrap';

import NavBar from './components/NavBar.jsx';
import Footer from './components/Footer.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useConfig } from './context/ConfigContext.jsx';

import CourseListPage from './pages/CourseListPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import PaymentResultPage from './pages/PaymentResultPage.jsx';
import OrderConfirmationPage from './pages/OrderConfirmationPage.jsx';
import OrderHistoryPage from './pages/OrderHistoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function FullPageSpinner() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <Spinner animation="border" role="status" />
    </div>
  );
}

export default function App() {
  const { paypalClientId, paypalMode, loading } = useConfig();

  // The PayPal SDK provider wraps the app so <PayPalButtons/> works anywhere.
  // currency + intent are set here; the client id comes from the backend config.
  const paypalOptions = {
    clientId: paypalClientId || 'test',
    currency: 'USD',
    intent: 'capture',
    components: 'buttons',
  };

  return (
    <PayPalScriptProvider options={paypalOptions} deferLoading={loading || !paypalClientId}>
      <div className="d-flex flex-column min-vh-100">
        <NavBar paypalMode={paypalMode} />
        <main className="flex-grow-1">
          <Container className="py-4">
            <Routes>
              <Route path="/" element={<CourseListPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/checkout/:courseId"
                element={
                  <RequireAuth>
                    <CheckoutPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/payment/result"
                element={
                  <RequireAuth>
                    <PaymentResultPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders"
                element={
                  <RequireAuth>
                    <OrderHistoryPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders/:orderId"
                element={
                  <RequireAuth>
                    <OrderConfirmationPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminDashboardPage />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Container>
        </main>
        <Footer />
      </div>
    </PayPalScriptProvider>
  );
}
