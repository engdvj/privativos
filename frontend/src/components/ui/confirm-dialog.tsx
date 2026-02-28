import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={AlertTriangle}
      description="Confirme para continuar."
      maxWidthClassName="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" className="h-9 text-xs" onClick={() => void handleConfirm()} loading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/35 bg-destructive/8 px-3 py-2.5 text-[13px] leading-relaxed text-foreground dark:border-destructive/45 dark:bg-destructive/14">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <p>{description ?? "Essa acao nao pode ser desfeita."}</p>
      </div>
    </Modal>
  );
}
