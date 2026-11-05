// src/app/admin/_layout/AdminEditItemNavigator.tsx

"use client";

import { ItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { useDomainItemNavigation, type UseDomainItemNavigationOptions } from "@/lib/crud/hooks";

export type AdminEditItemNavigatorProps<T extends { id: string }> = UseDomainItemNavigationOptions<T> & {
  /** 選択欄の前のラベル(既定 "切り替え") */
  readonly label?: string;
};

/**
 * 管理の編集画面の「前後の項目へ移る」(ルートの側の部品)。データは src/lib/crud の useDomainItemNavigation、
 * 表示は移るだけの ItemNavigator(保存しない。未保存の守りは移動の仕組みの側)。
 * 編集の Screen が `<AdminPage title="…" actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}>` で置く
 * (domain = <domain>/entities/display.ts の domainDisplay、current = loader が返した今の行)
 */
/** SP(sm 未満)だけ選択欄を詰める。PC は SelectInput の既定の大きさ(88px の行に収まる) */
const SP_FIT = "max-sm:!h-8 max-sm:py-0";

export function AdminEditItemNavigator<T extends { id: string }>({ label, ...options }: AdminEditItemNavigatorProps<T>) {
  const navigation = useDomainItemNavigation(options);
  // 管理のヘッダーの行は高さが決まっている(SP 52px、中身 36px)。SP だけ選択欄を 32px(h-8)に詰めて収める。PC は今の大きさのまま
  return <ItemNavigator {...navigation} label={label} selectClassName={SP_FIT} />;
}
