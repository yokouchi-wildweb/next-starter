// src/components/Feedback/Skeleton/DetailModalSkeleton.tsx

"use client";

import { Block } from "@/components/Layout/Block";
import Modal from "@/components/Overlays/Modal";
import { Skeleton } from "@/components/Shadcn/skeleton";

export type DetailModalSkeletonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows?: number;
  cols?: number;
  className?: string;
};

export default function DetailModalSkeleton({
  open,
  onOpenChange,
  rows = 5,
  cols = 3,
  className,
}: DetailModalSkeletonProps) {
  const rowPlaceholders = Array.from({ length: rows });
  const colPlaceholders = Array.from({ length: cols });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={<Skeleton className="h-8 w-40" />} className={className}>
      <Block>
        <Skeleton className="mx-auto h-48 w-full max-w-md" />
        <table className="w-full table-fixed text-sm border border-border">
          <tbody>
            {rowPlaceholders.map((_, r) => (
              <tr key={r} className={r > 0 ? "border-t border-border" : undefined}>
                {colPlaceholders.map((_, c) => (
                  <td key={c} className="px-2 py-1 text-center">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
    </Modal>
  );
}
