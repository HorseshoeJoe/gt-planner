import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui.jsx';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold ${
      isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="mr-auto flex items-center gap-2 text-base font-bold text-slate-900">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
            GT
          </span>
          Group Travel Planner
        </Link>

        {user ? (
          <>
            <NavLink to="/" className={linkClass} end>
              My trips
            </NavLink>
            <NavLink to="/join" className={linkClass}>
              Join a trip
            </NavLink>
            <span className="hidden text-sm text-slate-600 sm:inline">
              Signed in as <strong className="font-semibold text-slate-800">{user.displayName || user.username}</strong>
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>
              Sign in
            </NavLink>
            <NavLink to="/register" className={linkClass}>
              Create account
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
