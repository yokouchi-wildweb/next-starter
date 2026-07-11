// src/lib/tableSuite/shared/ColumnHeader.tsx

"use client";

import React from "react";

import { HelpTip } from "@/components/Overlays/Tooltip";

/**
 * カラムヘッダーの表示内容を解決する
 *
 * headerHelp が指定されていればラベル + ?アイコン + ホバー説明（HelpTip）に合成し、
 * なければ header をそのまま返す。DataTable / RecordSelectionTable /
 * EditableGridTable のヘッダーセルから共通で使用する。
 *
 * 注意: sortable 列ではヘッダークリック=ソートのため、タッチ端末で
 * ヘルプをタップするとソートも同時に発火する（伝播は止めない仕様）。
 */
export function renderColumnHeader(
  header: React.ReactNode,
  headerHelp?: React.ReactNode
): React.ReactNode {
  if (!headerHelp) return header;
  return <HelpTip label={header} help={headerHelp} />;
}
