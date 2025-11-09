// src/components/Overlays/DetailModal/DetailTable.tsx

import { ReactNode, CSSProperties } from "react";
import type { DetailModalCell, DetailModalRow } from "./types";

export type DetailTableProps = {
  rows: DetailModalRow[];
};

const renderArrayRow = (
  row: ReactNode[],
  rowIndex: number,
  maxCols: number,
  cellWidth: (span: number) => CSSProperties,
) => (
  <tr key={rowIndex} className={rowIndex > 0 ? "border-t border-border" : undefined}>
    {row.map((cell, i) => {
      const span = i === row.length - 1 ? maxCols - i : 1;
      return (
        <td key={i} colSpan={span} style={cellWidth(span)}>
          {cell}
        </td>
      );
    })}
  </tr>
);

const renderCellRow = (
  row: DetailModalCell[],
  rowIndex: number,
  maxCols: number,
  cellWidth: (span: number) => CSSProperties,
) => (
  <tr key={rowIndex} className={rowIndex > 0 ? "border-t border-border" : undefined}>
    {row.map(({ label, value }, i) => {
      const span = i === row.length - 1 ? maxCols - i : 1;
      return (
        <td
          key={i}
          colSpan={span}
          style={cellWidth(span)}
          className="px-2 py-1 text-center"
        >
          <span className="font-semibold">{label}:</span>
          {row.length === 1 ? <br /> : " "}
          {value}
        </td>
      );
    })}
  </tr>
);

const isDetailModalCellArray = (row: DetailModalRow): row is DetailModalCell[] =>
  Array.isArray(row) &&
  row.every(
    (cell) =>
      typeof cell === "object" &&
      cell !== null &&
      "label" in cell &&
      "value" in cell,
  );

export default function DetailTable({ rows }: DetailTableProps) {
  const maxCols = rows.reduce((acc, row) => Math.max(acc, row.length), 0);
  const cellWidth = (span: number) => ({ width: `${(100 / maxCols) * span}%` });

  return (
    <table className="w-full table-fixed text-sm border border-border">
      <tbody>
        {rows.map((row, rowIndex) =>
          isDetailModalCellArray(row)
            ? renderCellRow(row, rowIndex, maxCols, cellWidth)
            : renderArrayRow(row as ReactNode[], rowIndex, maxCols, cellWidth),
        )}
      </tbody>
    </table>
  );
}

