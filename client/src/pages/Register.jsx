import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorNote, Field, Input } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const passwordTooShort = form.password.length > 0 && form.password.length < 8;

  async function onSubmit(e) {
    e.preventDefault();
    if (passwordTooShort) return;
    setError('');
    setBusy(true);
    try {
      await register({
        displayName: form.displayName.trim() || form.username.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mb-5 text-sm text-slate-600">One account lets you create trips and join anyone else&apos;s.</p>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <Field label="Full name" hint="Shown to other members of your trips.">
            {(props) => (
              <Input
                {...props}
                autoComplete="name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            )}
          </Field>

          <Field label="Username" required hint="Others use this to invite you.">
            {(props) => (
              <Input
                {...props}
                autoComplete="username"
                minLength={3}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            )}
          </Field>

          <Field label="Email" required>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            )}
          </Field>

          <Field
            label="Password"
            required
            hint="At least 8 characters."
            error={passwordTooShort ? 'Password must be at least 8 characters.' : ''}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            )}
          </Field>

          <Button type="submit" className="w-full" disabled={busy || passwordTooShort}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-700">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-700 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
