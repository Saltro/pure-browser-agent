import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from './button';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="dialogOverlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onOpenChange(false); }}>
      <div className="dialogContent" role="dialog" aria-modal="true">
        {title && (
          <div className="dialogHeader">
            <h2>{title}</h2>
            <button className="dialogClose" onClick={() => onOpenChange(false)} aria-label="Close"><X size={16} /></button>
          </div>
        )}
        <div className="dialogBody">{children}</div>
      </div>
    </div>
  );
}

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
}: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      {description && <p className="alertDialogDesc">{description}</p>}
      <div className="alertDialogActions">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          size="sm"
          onClick={() => { onConfirm(); onOpenChange(false); }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

type PromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
};

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [open, defaultValue]);

  function handleConfirm() {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      {description && <p className="alertDialogDesc">{description}</p>}
      <input
        ref={inputRef}
        className="dialogInput"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') onOpenChange(false);
        }}
        placeholder={placeholder}
        autoFocus
      />
      <div className="alertDialogActions">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
        <Button variant="default" size="sm" onClick={handleConfirm} disabled={!value.trim()}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
