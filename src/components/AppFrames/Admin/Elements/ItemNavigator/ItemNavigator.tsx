// src/components/AppFrames/Admin/Elements/ItemNavigator/ItemNavigator.tsx

"use client";

import { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort";

import { SelectInput } from "@/components/Form/Input/Manual/Select";
import { Flex } from "@/components/Layout/Flex";
import { cn } from "@/lib/cn";
import type { ItemNavigatorProps } from "./types";

/**
 * 長い項目名の決まり(どの画面幅でも同じ):
 * - 閉じた値は 1 行で末尾を … で省く(shadcn は値の span を flex + line-clamp にしていて … が出ないので block + min-w-0 + truncate にする)
 * - 開いた一覧の幅は 最小 = 選択欄の幅(shadcn の既定)、最大 = 画面の幅 − 左右 16px。項目名は折り返して全文を見せる
 */
const VALUE_TRUNCATE = "*:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate";
const LIST_BOUNDED = "max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:wrap-anywhere";

/**
 * 編集画面の「前後の項目へ移る」選択欄(移るだけ。保存・入力の検証・トースト・ヘッダーへの差し込みは持たない)。
 * 選ぶと getPath(id) へ router.push する。置き場は呼ぶ側(ルートの画面が <AdminPage actions={…}> に置く)。
 * データは src/lib/crud の useDomainItemNavigation が返す(items / currentId / getPath / getLabel をそのまま渡す)。
 * 未保存の編集の守りは移動の仕組みの側(後の指令)で受け止める
 *
 * @example
 * const navigation = useDomainItemNavigation({ domain: sampleDisplay, current: sample });
 * return <ItemNavigator {...navigation} />;
 */
export function ItemNavigator<T extends { id: string }>({
  items,
  currentId,
  getLabel,
  getPath,
  isLoading = false,
  disabled = false,
  label = "切り替え",
  labelClassName,
  placeholder,
  className,
  selectClassName,
}: ItemNavigatorProps<T>) {
  const router = useRouter();

  const options = items.map((item) => ({
    value: item.id,
    label: getLabel(item),
  }));

  const handleChange = (value: string | number | boolean | null | "") => {
    if (value === null || value === "" || typeof value === "boolean") return;
    const nextId = String(value);
    if (nextId === currentId) return;
    router.push(getPath(nextId));
  };

  return (
    <Flex align="center" gap="xs" className={cn("min-w-0", className)}>
      <span className={cn("shrink-0 text-sm text-muted-foreground", labelClassName)}>{label}</span>
      <SelectInput
        value={currentId}
        onChange={handleChange}
        options={options}
        disabled={disabled || isLoading}
        showPlaceholderOption={false}
        placeholder={placeholder}
        className={cn("min-w-[160px] max-w-[240px]", VALUE_TRUNCATE, selectClassName)}
        contentClassName={LIST_BOUNDED}
      />
    </Flex>
  );
}
