import React, { useEffect, useId, useRef } from 'react';
import { IconX } from '../icons';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Minimal modal — spec §7 says avoid modals for tiny actions; this is for
 *  meaningful dialogs only (forms, confirmations, day details).
 *  Focus is moved into the dialog on open, trapped while open, restored to
 *  the previously focused element on close; Escape/overlay-close preserved. */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (prefer the first focusable field).
    const dialog = dialogRef.current;
    if (dialog) {
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? dialog).focus();
    }

    // Lock background scrolling while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Cycle Tab/Shift+Tab within the dialog.
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const idx = focusables.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const next =
          e.shiftKey
            ? focusables[(idx <= 0 ? focusables.length : idx) - 1]
            : focusables[(idx + 1) % focusables.length];
        next.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);

    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        style={wide ? { maxWidth: 560 } : undefined}
      >
        <div className="modal-head">
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close dialog">
            <IconX size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation dialog; optionally requires typing a phrase for destructive actions. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  requireText,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [text, setText] = React.useState('');
  const ok = !requireText || text.trim() === requireText;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={!ok}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="secondary">{message}</div>
        {requireText && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="confirm-phrase">
              Type <strong style={{ color: 'var(--danger)' }}>{requireText}</strong> to confirm
            </label>
            <input
              id="confirm-phrase"
              className={`input${ok ? '' : ' input-error'}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
