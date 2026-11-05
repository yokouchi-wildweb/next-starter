// src/components/AppFrames/Admin/Elements/ItemNavigator/ItemNavigator.tsx

"use client";

import { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort";

import { SelectInput } from "@/components/Form/Input/Manual/Select";
import { Flex } from "@/components/Layout/Flex";
import { cn } from "@/lib/cn";
import type { ItemNavigatorProps } from "./types";

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
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <SelectInput
        value={currentId}
        onChange={handleChange}
        options={options}
        disabled={disabled || isLoading}
        showPlaceholderOption={false}
        placeholder={placeholder}
        className={cn("min-w-[160px] max-w-[240px]", selectClassName)}
      />
    </Flex>
  );
}
