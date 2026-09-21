import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JoinTrip from './pages/JoinTrip.jsx';
import TripWorkspace from './pages/TripWorkspace.jsx';
import FullItinerary from './pages/FullItinerary.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Restoring your session" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <NavBar />
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/join"
            element={
              <RequireAuth>
                <JoinTrip />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:tripId"
            element={
              <RequireAuth>
                <TripWorkspace />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:tripId/full-itinerary"
            element={
              <RequireAuth>
                <FullItinerary />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-xs text-slate-600">
        Group Travel Planner — CPAN 314 Group 3 · Phase 3 final prototype
      </footer>
    </div>
  );
}
