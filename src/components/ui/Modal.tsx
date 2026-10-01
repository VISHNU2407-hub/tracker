import React, { useEffect } from 'react';
import { IconX } from '../icons';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

/** Minimal modal — spec §7 says avoid modals for tiny actions; this is for
 *  meaningful dialogs only (forms, confirmations, day details). */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
        }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 560 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
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
