"use client";

// src/features/core/messaging/adminBulkActions/delete.tsx
// 送信一覧の一括操作: 選んだ送信を削除する(D88 D95)。上流の既定の項目。
// 確認の Dialog に削除の見込み(DispatchDeleteSummary)を出し、確定で bulk-delete。100 件を超えると押せない。
// 終わったら onDone(容器が選択を空にして一覧を取り直す)

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { Dialog } from "@/components/Overlays/Dialog";
import type { BulkActionProps } from "@/lib/tableSuite";

import { DispatchDeleteSummary } from "@/features/core/messaging/components/common/DispatchDeleteSummary";
import { DISPATCH_DELETE_MAX, useBulkDeleteDispatches } from "@/features/core/messaging/hooks/useBulkDeleteDispatches";
import { useDispatchDeleteSummary } from "@/features/core/messaging/hooks/useDispatchDeleteSummary";
import type { AdminDispatchSummary } from "@/features/core/messaging/services/client/adminMessagingClient";
import type { MessagingDispatchAdminBulkActionItem } from "@/features/core/messaging/types/adminBulkAction";

function DeleteDispatches({ selection, onDone }: BulkActionProps<AdminDispatchSummary>) {
  const [open, setOpen] = useState(false);
  const ids = selection.selectedIds;
  const overLimit = ids.length > DISPATCH_DELETE_MAX;
  const { summary, isLoading, error } = useDispatchDeleteSummary(ids, open);
  const { remove } = useBulkDeleteDispatches();
  return (
    <>
      <Button type="button" size="sm" variant="destructive" disabled={ids.length === 0 || overLimit} onClick={() => setOpen(true)}>
        {overLimit ? `削除は ${DISPATCH_DELETE_MAX} 件まで` : "削除"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        layer="floating"
        overlayLayer="floating"
        title={`${ids.length} 件の送信を削除`}
        confirmLabel="削除する"
        confirmVariant="destructive"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          const done = await remove(ids);
          setOpen(false);
          if (done.length > 0) onDone();
        }}
      >
        <DispatchDeleteSummary summary={summary} isLoading={isLoading} error={error} />
      </Dialog>
    </>
  );
}

export const bulkAction: MessagingDispatchAdminBulkActionItem = { key: "delete", Component: DeleteDispatches, order: 10 };
