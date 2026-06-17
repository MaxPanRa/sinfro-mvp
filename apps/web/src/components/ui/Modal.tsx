import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-root" role="dialog" aria-modal="true">
      <button className="modal-backdrop" aria-label="Cerrar modal" onClick={onClose} />
      {children}
    </div>
  );
}
