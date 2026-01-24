import React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { cn } from "@/lib/cn";

export type BulkActionSelection<T> = {
  /** 選択されたレコードのキー配列 */
  selectedKeys: React.Key[];
  /** 選択されたレコードのオブジェクト配列 */
  selectedRows: T[];
  /** 選択されたレコードのID配列（文字列） */
  selectedIds: string[];
  /** 選択件数 */
  count: number;
  /** 選択をクリアする関数 */
  clear: () => void;
};

type BulkActionBarProps<T> = {
  selection: BulkActionSelection<T>;
  bulkActions: (selection: BulkActionSelection<T>) => React.ReactNode;
};

export function BulkActionBar<T>({ selection, bulkActions }: BulkActionBarProps<T>) {
  const isVisible = selection.count > 0;

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        isVisible ? "mb-4 max-h-20 opacity-100" : "mb-0 max-h-0 opacity-0"
      )}
    >
      <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        {/* 左側: 共通部分 */}
        <div className="flex flex-1 items-center gap-2">
          <span className="font-medium text-primary">{selection.count}件選択中</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selection.clear}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4" />
            選択解除
          </Button>
        </div>

        {/* 右側: カスタムアクション */}
        <div className="flex gap-2">{bulkActions(selection)}</div>
      </div>
    </div>
  );
}
