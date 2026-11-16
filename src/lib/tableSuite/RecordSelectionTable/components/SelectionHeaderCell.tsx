import React from "react";

import { Checkbox, type CheckedState } from "@/components/Primitives/Checkbox";
import { cn } from "@/lib/cn";

// visible = 選択の on / off。列はいつも置き、off は幅 0・透明・inert(押せない・フォーカスしない・読み上げない)。
// 出入りは幅と濃さを 200ms の linear で動かす(RecordSelectionList のチェックの列と同じ)

import { TableHead } from "../../shared";
import { isCheckboxEvent } from "../utils/checkboxEvent";

type SelectionHeaderCellProps = {
  /** 選択の on / off(off = 幅 0 で隠す。出入りは動く) @default true */
  visible?: boolean;
  label: string;
  isCheckboxSelection: boolean;
  checked: boolean;
  indeterminate: boolean;
  onToggle: (checked: boolean) => void;
  onRequestToggle: () => void;
};

const resolveCheckboxState = (state: boolean, indeterminate: boolean): CheckedState => {
  if (indeterminate) {
    return "indeterminate";
  }
  return state;
};

export function SelectionHeaderCell({
  visible = true,
  label,
  isCheckboxSelection,
  checked,
  indeterminate,
  onToggle,
  onRequestToggle,
}: SelectionHeaderCellProps) {
  const handleCellClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isCheckboxSelection || !visible) {
      return;
    }
    event.stopPropagation();
    if (isCheckboxEvent(event)) {
      return;
    }
    onRequestToggle();
  };

  return (
    <TableHead
      className={cn(
        "transition-[padding] duration-200 ease-linear",
        visible ? "w-10" : "w-0 px-0",
        visible && isCheckboxSelection && "cursor-pointer select-none",
      )}
      onClick={isCheckboxSelection && visible ? handleCellClick : undefined}
      inert={!visible}
      aria-hidden={visible ? undefined : true}
    >
      <div
        className={cn(
          "flex h-full items-center justify-center overflow-hidden transition-[width,opacity] duration-200 ease-linear",
          visible ? "w-10 opacity-100" : "w-0 opacity-0",
        )}
      >
        <Checkbox
          data-table-checkbox-root="true"
          aria-label={`${label}を全て切り替える`}
          checked={resolveCheckboxState(checked, indeterminate)}
          onCheckedChange={(next) => onToggle(next === true)}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </TableHead>
  );
}
