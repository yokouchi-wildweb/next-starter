// DetailTable の出力を比べる場合の一覧(render テストと期待値の記録で同じ物を使う)
import { createElement, type ReactElement } from "react";

import DetailTable from "./DetailTable";

export const detailTableCases: Record<string, ReactElement> = {
  arrays: createElement(DetailTable, { rows: [["名前", "山田"], ["メール", "a@example.test", "メモ"]] }),
  cells: createElement(DetailTable, {
    rows: [
      [{ label: "ID", value: "u1" }, { label: "状態", value: "有効" }],
      [{ label: "説明", value: "長い説明" }],
    ],
  }),
};
