import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../components/ToastProvider.jsx';
import { Button, Card, ErrorNote, Field, Input } from '../components/ui.jsx';

export default function JoinTrip() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { message, trip } = await api.post('/trips/join', { inviteCode: code });
      toast.success(message);
      navigate(`/trips/${trip._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Join a trip</h1>
      <p className="mb-5 text-sm text-slate-600">Enter the invite code the trip creator shared with you.</p>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <Field label="Invite code" required hint="Eight characters, for example K7M3PQXR.">
            {(props) => (
              <Input
                {...props}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="min-h-touch w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold uppercase tracking-widest"
                maxLength={12}
                required
              />
            )}
          </Field>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Joining…' : 'Join trip'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
