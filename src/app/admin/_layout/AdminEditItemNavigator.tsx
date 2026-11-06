// src/app/admin/_layout/AdminEditItemNavigator.tsx

"use client";

import { ItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { useDomainItemNavigation, type UseDomainItemNavigationOptions } from "@/lib/crud/hooks";

export type AdminEditItemNavigatorProps<T extends { id: string }> = UseDomainItemNavigationOptions<T> & {
  /** 選択欄の前のラベル(既定 "切り替え") */
  readonly label?: string;
};

/**
 * SP(sm 未満)だけ選択欄を詰める: 高さ 32px(h-8)、幅は行の残りまで縮む(最小幅を外す)。
 * 長い項目名の … と開いた一覧の幅の上限は ItemNavigator の決まり(どの画面幅でも)。
 * PC は SelectInput の既定の大きさ(88px の行に収まる)と ItemNavigator の幅(160〜240px)のまま
 */
const SP_FIT = "max-sm:!h-8 max-sm:py-0 max-sm:min-w-0 max-sm:max-w-none";
/** SP だけラベル「切り替え」を見た目から隠す(読み上げには残る)。選択欄に幅を回す。PC はラベルを出す */
const SP_LABEL = "max-sm:sr-only";

/**
 * 管理の編集画面の「前後の項目へ移る」(ルートの側の部品)。データは src/lib/crud の useDomainItemNavigation、
 * 表示は移るだけの ItemNavigator(保存しない。未保存の守りは移動の仕組みの側)。
 * 編集の Screen が `<AdminPage title="…" actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}>` で置く
 * (domain = <domain>/entities/display.ts の domainDisplay、current = loader が返した今の行)
 */
export function AdminEditItemNavigator<T extends { id: string }>({ label, ...options }: AdminEditItemNavigatorProps<T>) {
  const navigation = useDomainItemNavigation(options);
  // 管理のヘッダーの行は高さと幅が決まっている(SP 52px、中身 36px)。SP だけ選択欄を詰め・縮めて収める。PC は今の大きさのまま
  return <ItemNavigator {...navigation} label={label} labelClassName={SP_LABEL} selectClassName={SP_FIT} />;
}
