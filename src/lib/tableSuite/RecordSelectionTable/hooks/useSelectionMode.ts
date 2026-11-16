// src/lib/tableSuite/RecordSelectionTable/hooks/useSelectionMode.ts
//
// 選択の出し方(selectionMode、D97 D98)。RecordSelectionTable と RecordSelectionList が同じ物を使う。
// - onSelect(既定): チェックはいつも出し、一括操作の帯は 1 件以上選んだ時だけ
// - always: チェックも帯もいつも出す
// - toggle: 帯はいつも出し、その中の「選択モード」の切り替えが入の間だけチェックと操作を出す。切にすると選択を空に戻す
// selectionBehavior(行を押して選ぶか、チェックだけで選ぶか)とは別の軸

import React from "react";

export type SelectionMode = "onSelect" | "always" | "toggle";

export function useSelectionMode(mode: SelectionMode, clear: () => void) {
  const [toggleOn, setToggleOn] = React.useState(false);
  const selectionOn = mode !== "toggle" || toggleOn;
  const setSelectionOn = React.useCallback(
    (next: boolean) => {
      setToggleOn(next);
      if (!next) clear();
    },
    [clear],
  );
  return {
    /** チェックを出す・選べる */
    selectionOn,
    /** toggle の切り替え(切で選択を空に) */
    setSelectionOn,
  };
}
