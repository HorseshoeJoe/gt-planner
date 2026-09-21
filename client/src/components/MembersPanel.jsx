import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './ToastProvider.jsx';
import { Badge, Button, Card, ErrorNote, Field, Input, SectionHeading, Spinner } from './ui.jsx';

/**
 * Members and invitations.
 *
 * Phase 2 enhancement - member status indicator (Stakeholder Meeting 2, Q2):
 * "is there a way to see who has already joined and who hasn't? A simple
 * 'member status' indicator would be very useful."
 */
export default function MembersPanel({ trip, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/trips/${trip._id}/members`));
    } catch (err) {
      toast.error(err.message);
    }
  }, [trip._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { message } = await api.post(`/trips/${trip._id}/invite`, { identifier: identifier.trim() });
      toast.success(message);
      setIdentifier('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.displayName} from this trip?`)) return;
    try {
      await api.del(`/trips/${trip._id}/members/${member.membershipId}`);
      toast.success('Member removed.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(data.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info(`Invite code: ${data.inviteCode}`);
    }
  }

  if (!data) return <Spinner label="Loading members" />;

  const isAdmin = trip.myRole === 'admin';

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <SectionHeading
          title="Members"
          subtitle={`${data.counts.joined} joined · ${data.counts.pending} awaiting response`}
        />

        <ul className="divide-y divide-slate-200">
          {data.members.map((member) => (
            <li key={member.membershipId} className="flex flex-wrap items-center gap-3 py-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 font-bold text-brand-800"
              >
                {(member.displayName || member.username || '?').charAt(0).toUpperCase()}
              </span>

              <div className="mr-auto min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {member.displayName}
                  {String(member.userId) === String(user.userId) && (
                    <span className="ml-1 text-sm font-normal text-slate-600">(you)</span>
                  )}
                </p>
                <p className="truncate text-sm text-slate-600">@{member.username}</p>
              </div>

              <div className="flex items-center gap-2">
                {member.role === 'admin' && <Badge tone="blue">Trip creator</Badge>}
                {member.status === 'joined' ? (
                  <Badge tone="green">✓ Joined</Badge>
                ) : (
                  <Badge tone="amber">● Invite pending</Badge>
                )}
                {isAdmin && member.role !== 'admin' && (
                  <Button variant="ghost" onClick={() => removeMember(member)} aria-label={`Remove ${member.displayName}`}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card>
          <SectionHeading title="Invite by username" subtitle="The person must already have an account." />
          <form className="space-y-3" onSubmit={invite} noValidate>
            <ErrorNote>{error}</ErrorNote>
            <Field label="Username or email">
              {(props) => (
                <Input {...props} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="e.g. chantal" required />
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !identifier.trim()}>
              {busy ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </Card>

        <Card>
          <SectionHeading title="Shareable invite code" subtitle="Anyone with this code can join the trip." />
          <p className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-center text-xl font-bold tracking-[0.3em] text-slate-900">
            {data.inviteCode}
          </p>
          <Button variant="secondary" className="mt-3 w-full" onClick={copyCode}>
            {copied ? 'Copied ✓' : 'Copy code'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
