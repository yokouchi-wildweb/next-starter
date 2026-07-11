// src/lib/tableSuite/shared/FullWidthRows.tsx

"use client";

import * as React from "react";

import type { FullWidthRow } from "../types";
import { TableRow } from "./TableRow";
import { TableCell } from "./TableCell";

type FullWidthRowsAtProps = {
  /** groupFullWidthRowsByIndex でグループ化済みの差し込み行 */
  rowsByIndex: Map<number, FullWidthRow[]>;
  /** このデータ行 index の直後に挿入する行を描画する（-1 = 先頭） */
  index: number;
  /** 選択列など追加列を含むテーブル全体のカラム数 */
  colSpan: number;
};

/**
 * 指定 index の直後に挿入する全幅差し込み行を描画する。
 * 全カラムを結合した1セル（colSpan）として描画し、
 * ホバー・選択・行クリックの対象にはならない。
 */
export function FullWidthRowsAt({ rowsByIndex, index, colSpan }: FullWidthRowsAtProps) {
  const rows = rowsByIndex.get(index);
  if (!rows) {
    return null;
  }
  return (
    <>
      {rows.map((row) => (
        <TableRow key={`fullwidth-${row.key}`} disableHover className={row.className}>
          <TableCell colSpan={colSpan} className="p-0">
            {row.render()}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
