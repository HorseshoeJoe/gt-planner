import { useEffect, useRef } from 'react';

/* Shared presentational building blocks. Keeping them in one module means the
   accessibility rules (labels, focus rings, 44px touch targets) are applied
   once and inherited by every feature panel. */

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-brand-700 hover:bg-brand-50',
};

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-4 py-2
        text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

let fieldSeq = 0;

/** Label + control + optional hint/error, wired together with htmlFor/aria. */
export function Field({ label, hint, error, children, required }) {
  const idRef = useRef(null);
  if (!idRef.current) {
    fieldSeq += 1;
    idRef.current = `field-${fieldSeq}`;
  }
  const id = idRef.current;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy || undefined, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500';

export const Input = (props) => <input className={CONTROL} {...props} />;
export const Select = ({ children, ...props }) => (
  <select className={CONTROL} {...props}>
    {children}
  </select>
);
export const Textarea = (props) => <textarea className={`${CONTROL} min-h-[5rem]`} {...props} />;

export function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-800 border-slate-300',
    green: 'bg-green-100 text-green-900 border-green-300',
    amber: 'bg-amber-100 text-amber-900 border-amber-400',
    blue: 'bg-brand-50 text-brand-800 border-brand-100',
    red: 'bg-red-100 text-red-900 border-red-300',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-sm text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
      {label}…
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
      {children}
    </p>
  );
}

/** Accessible modal: labelled, closes on Escape, restores focus on exit. */
export function Modal({ open, title, onClose, children }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Callers pass an inline arrow for onClose, so its identity changes on every
  // render of the parent. Keeping it in a ref means the effects below depend
  // only on `open` - otherwise they would tear down and re-run on every
  // keystroke, and the focus() call would pull the caret out of the field the
  // user is typing in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus management: runs once when the dialog opens, and once when it closes.
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;

    // Prefer the first real control so the user can start typing immediately;
    // fall back to the dialog itself when it contains no inputs.
    const firstControl = panelRef.current?.querySelector(
      'input:not([type="hidden"]), select, textarea'
    );
    (firstControl || panelRef.current)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape-to-close, kept separate so it never interferes with focus.
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
