// src/components/AppFrames/Admin/Elements/ItemNavigator/ItemNavigator.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AdminHeaderPortal } from "@/components/AppFrames/Admin/Elements/AdminHeaderPortal";
import { SelectInput } from "@/components/Form/Input/Manual/Select";
import { Flex } from "@/components/Layout/Flex";
import { cn } from "@/lib/cn";
import type { ItemNavigatorProps } from "./types";

/**
 * アイテム並行移動コンポーネント
 *
 * 編集画面などで、現在のアイテムを別のアイテムに切り替えるためのセレクトボックスUI。
 * AdminHeaderPortalと組み合わせてヘッダーに配置することも可能。
 *
 * @example
 * // 基本的な使用方法（ヘッダー右側に配置）
 * <ItemNavigator
 *   items={items}
 *   currentId={sample.id}
 *   getLabel={(item) => item.name}
 *   getPath={(id) => `/admin/samples/${id}/edit`}
 * />
 *
 * @example
 * // 遷移前に処理を挟む
 * <ItemNavigator
 *   items={items}
 *   currentId={sample.id}
 *   getLabel={(item) => item.name}
 *   getPath={(id) => `/admin/samples/${id}/edit`}
 *   onBeforeNavigate={async (nextId) => {
 *     await saveForm();
 *     return true; // 遷移を許可
 *   }}
 * />
 */
export function ItemNavigator<T extends { id: string }>({
  items,
  currentId,
  getLabel,
  getPath,
  onBeforeNavigate,
  isLoading = false,
  disabled = false,
  label = "切り替え",
  placeholder,
  usePortal = true,
  slot = "right",
  className,
}: ItemNavigatorProps<T>) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const options = items.map((item) => ({
    value: item.id,
    label: getLabel(item),
  }));

  const handleChange = async (value: string | number | boolean | null | "") => {
    if (value === null || value === "" || typeof value === "boolean") return;
    const nextId = String(value);
    if (nextId === currentId) return;

    setIsPending(true);
    try {
      // 遷移前処理がある場合は実行
      if (onBeforeNavigate) {
        const shouldNavigate = await onBeforeNavigate(nextId, currentId);
        if (!shouldNavigate) {
          return; // 遷移キャンセル
        }
      }

      // 遷移実行
      router.push(getPath(nextId));
    } finally {
      setIsPending(false);
    }
  };

  const isDisabled = disabled || isPending || isLoading;

  const content = (
    <Flex align="center" gap="xs" className={cn("min-w-0", className)}>
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <SelectInput
        value={currentId}
        onChange={handleChange}
        options={options}
        disabled={isDisabled}
        showPlaceholderOption={false}
        placeholder={placeholder}
        className="min-w-[160px] max-w-[240px]"
      />
    </Flex>
  );

  if (usePortal) {
    return <AdminHeaderPortal slot={slot}>{content}</AdminHeaderPortal>;
  }

  return content;
}
