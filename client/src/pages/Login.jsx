import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorNote, Field, Input } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.identifier.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mb-5 text-sm text-slate-600">Welcome back — pick up your trip planning where you left off.</p>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <Field label="Username or email" required>
            {(props) => (
              <Input
                {...props}
                autoComplete="username"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                required
              />
            )}
          </Field>

          <Field label="Password" required>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            )}
          </Field>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-700">
        No account yet?{' '}
        <Link to="/register" className="font-semibold text-brand-700 underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
