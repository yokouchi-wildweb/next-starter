// src/components/Overlays/ConfirmDialog.tsx

"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/Overlays/Dialog";
import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  titleSrOnly?: boolean;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  confirmDisabled?: boolean;
  confirmVariant?: ButtonStyleProps["variant"];
  cancelVariant?: ButtonStyleProps["variant"];
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  titleSrOnly,
  description,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  confirmDisabled,
  confirmVariant = "destructive",
  cancelVariant = "outline",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle srOnly={titleSrOnly}>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <DialogFooter className="mt-4">
          <Button
            size="sm"
            variant={cancelVariant}
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={confirmVariant}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
