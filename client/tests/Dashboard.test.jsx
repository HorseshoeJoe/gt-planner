import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard.jsx';
import { ToastProvider } from '../src/components/ToastProvider.jsx';
import { api } from '../src/api/client.js';

// The API layer is mocked so these tests exercise the UI only; the real
// endpoints are covered by the server's end-to-end suite.
vi.mock('../src/api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
  tokenStore: { get: vi.fn(), set: vi.fn(), clear: vi.fn() },
}));

function renderDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('Dashboard - create trip form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([]);
    api.post.mockResolvedValue({ _id: 'trip-1' });
  });

  it('shows an empty state before any trips exist', async () => {
    renderDashboard();
    expect(await screen.findByText('No trips yet')).toBeInTheDocument();
  });

  it('accepts full text in every field and submits the complete trip', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: '+ New trip' }));

    // Each keystroke updates state on the page component, which is what made
    // the dialog steal focus before the Modal fix.
    await user.type(screen.getByLabelText(/Trip name/), 'Tokyo Spring Trip');
    await user.type(screen.getByLabelText(/Destination/), 'Tokyo, Japan');
    await user.type(screen.getByLabelText(/Start date/), '2026-09-14');
    await user.type(screen.getByLabelText(/End date/), '2026-09-17');
    await user.type(screen.getByLabelText(/Description/), 'Four days with the group.');

    expect(screen.getByLabelText(/Trip name/)).toHaveValue('Tokyo Spring Trip');
    expect(screen.getByLabelText(/Destination/)).toHaveValue('Tokyo, Japan');

    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/trips', {
        title: 'Tokyo Spring Trip',
        destination: 'Tokyo, Japan',
        startDate: '2026-09-14',
        endDate: '2026-09-17',
        description: 'Four days with the group.',
      })
    );
  });

  it('rejects an end date before the start date without calling the API', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: '+ New trip' }));
    await user.type(screen.getByLabelText(/Trip name/), 'Backwards');
    await user.type(screen.getByLabelText(/Destination/), 'Nowhere');
    await user.type(screen.getByLabelText(/Start date/), '2026-09-17');
    await user.type(screen.getByLabelText(/End date/), '2026-09-14');
    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'End date cannot be before the start date.'
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('surfaces an API error message in the form', async () => {
    api.post.mockRejectedValue(new Error('Something went wrong on the server.'));
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: '+ New trip' }));
    await user.type(screen.getByLabelText(/Trip name/), 'Trip');
    await user.type(screen.getByLabelText(/Destination/), 'Place');
    await user.type(screen.getByLabelText(/Start date/), '2026-09-14');
    await user.type(screen.getByLabelText(/End date/), '2026-09-17');
    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on the server.');
  });

  it('closes the dialog with the Cancel button', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: '+ New trip' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Dashboard - trip list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('separates joined trips from pending invitations and shows member counts', async () => {
    api.get.mockResolvedValue([
      {
        _id: 't1', title: 'Tokyo Trip', destination: 'Tokyo', myRole: 'admin', myStatus: 'joined',
        startDate: '2026-09-14', endDate: '2026-09-17', memberCounts: { joined: 2, pending: 1 },
      },
      {
        _id: 't2', title: 'Montreal Weekend', destination: 'Montreal', myRole: 'member', myStatus: 'pending',
        startDate: '2026-10-01', endDate: '2026-10-03', memberCounts: { joined: 3, pending: 1 },
      },
    ]);

    renderDashboard();

    expect(await screen.findByText('Tokyo Trip')).toBeInTheDocument();
    expect(screen.getByText('Pending invitations')).toBeInTheDocument();
    expect(screen.getByText('Montreal Weekend')).toBeInTheDocument();

    // The member status indicator from Stakeholder Meeting 2.
    expect(screen.getByText('2 joined')).toBeInTheDocument();
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
  });
});
