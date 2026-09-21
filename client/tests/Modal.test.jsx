import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, Field, Input, Button } from '../src/components/ui.jsx';

/**
 * Regression tests for the dialog focus bug.
 *
 * Symptom: typing in any form inside a Modal accepted one character, then the
 * dialog itself took focus and further keystrokes were lost.
 *
 * Cause: the focus effect listed `onClose` in its dependency array. Every caller
 * passes an inline arrow function, so `onClose` was a new value on each render.
 * Each keystroke updated parent state, re-ran the effect, and moved focus to the
 * dialog panel. These tests reproduce that exact arrangement.
 */

/** A dialog whose parent re-renders on every keystroke, as the real pages do. */
function ControlledDialog({ onSubmit = () => {} }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('');

  return (
    <Modal open={open} title="Create a new trip" onClose={() => setOpen(false)}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
        <Field label="Trip name">
          {(props) => <Input {...props} value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <Button type="submit">Create trip</Button>
      </form>
    </Modal>
  );
}

describe('Modal', () => {
  it('accepts a full string of typed input without losing focus', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    const input = screen.getByLabelText('Trip name');
    await user.click(input);
    await user.type(input, 'Tokyo Trip');

    // Before the fix this was 'T' - the first keystroke re-ran the focus effect
    // and the rest went to the dialog panel.
    expect(input).toHaveValue('Tokyo Trip');
    expect(input).toHaveFocus();
  });

  it('keeps focus in the field across many re-renders', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    const input = screen.getByLabelText('Trip name');
    await user.click(input);

    for (const char of 'abcdefghij') {
      await user.keyboard(char);
      expect(input).toHaveFocus();
    }
    expect(input).toHaveValue('abcdefghij');
  });

  it('submits the complete value', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ControlledDialog onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Trip name'), 'Osaka');
    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(onSubmit).toHaveBeenCalledWith('Osaka');
  });

  it('focuses the first control when it opens, so typing can start immediately', async () => {
    render(<ControlledDialog />);
    expect(screen.getByLabelText('Trip name')).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is announced as a labelled modal dialog', () => {
    render(<ControlledDialog />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Create a new trip');
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} title="Hidden" onClose={() => {}}><p>content</p></Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Field', () => {
  it('associates the label with its control', () => {
    render(
      <Field label="Destination" hint="Where are you going?">
        {(props) => <Input {...props} defaultValue="" />}
      </Field>
    );

    const input = screen.getByLabelText('Destination');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Where are you going?');
  });

  it('exposes validation errors to assistive technology', () => {
    render(
      <Field label="Password" error="Password must be at least 8 characters.">
        {(props) => <Input {...props} defaultValue="" />}
      </Field>
    );

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Password must be at least 8 characters.');
  });
});
