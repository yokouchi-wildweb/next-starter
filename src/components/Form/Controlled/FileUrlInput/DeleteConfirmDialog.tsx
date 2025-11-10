import ConfirmDialog from "@/components/Overlays/ConfirmDialog";

export type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
};

export const DeleteConfirmDialog = (
  props: DeleteConfirmDialogProps,
) => {
  const { open, onOpenChange, onConfirm } = props;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="画像削除"
      description="画像を削除してもよろしいですか？"
      confirmLabel="削除する"
      cancelLabel="キャンセル"
      onConfirm={onConfirm}
    />
  );
};

