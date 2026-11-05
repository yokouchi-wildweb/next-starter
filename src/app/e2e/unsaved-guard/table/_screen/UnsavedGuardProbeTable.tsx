// src/app/e2e/unsaved-guard/table/_screen/UnsavedGuardProbeTable.tsx
// 受入のテストの表: 書ける列 1 つの EditableGridTable。onCellChange は「保存を終える」を押すまで終わらない Promise を返す(保存待ち)。
// 「保存を終える」は待っている保存を全部終える(Enter の確定の後の blur でも確定が呼ばれ、保存が 2 つになることがある)。
// 離れる入口は棚の Link 1 つ(ほかの経路はフォームの行で確かめた。表の行は守りの元が表から立つことを確かめる)

"use client";

import { type Key, useCallback, useRef, useState } from "react";

import { Button } from "@/components/Form/Button";
import { Link } from "@/components/Navigation";
import { EditableGridTable, type EditableGridColumn } from "@/lib/tableSuite";

const TARGET = "/e2e/unsaved-guard/target";

type Row = { id: string; name: string };

const COLUMNS: EditableGridColumn<Row>[] = [{ field: "name", header: "name", editorType: "text" }];

export function UnsavedGuardProbeTable() {
  const [rows, setRows] = useState<Row[]>([{ id: "1", name: "alpha" }]);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef<(() => void)[]>([]);
  const handleCellChange = useCallback(({ rowKey, value }: { rowKey: Key; value: unknown }) => {
    setRows((prev) => prev.map((row) => (row.id === rowKey ? { ...row, name: String(value ?? "") } : row)));
    setSaving(true);
    return new Promise<void>((resolve) => {
      pendingRef.current.push(resolve);
    });
  }, []);
  const finishSave = useCallback(() => {
    const pending = pendingRef.current.splice(0);
    setSaving(false);
    pending.forEach((resolve) => resolve());
  }, []);
  return (
    <div id="probe-table">
      <EditableGridTable<Row> items={rows} columns={COLUMNS} getKey={(row) => row.id} onCellChange={handleCellChange} />
      <p id="value">{rows[0].name}</p>
      <p id="saving">{saving ? "saving" : "idle"}</p>
      <Button id="finish-save" type="button" onClick={finishSave}>
        finish save
      </Button>
      <Link id="shelf-link" href={TARGET}>
        shelf link
      </Link>
    </div>
  );
}
