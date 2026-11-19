"use client";

import React from "react";

import { Checkbox } from "@/components/Primitives/Checkbox";
import { cn } from "@/lib/cn";
import { Flex } from "@/components/Layout/Flex";

// visible = 選択の on / off。列はいつも置き、off は幅 0・透明・inert(押せない・フォーカスしない・読み上げない)。
// 出入りは幅と濃さを 200ms の linear で動かす(RecordSelectionList のチェックの列と同じ)

import { TableCell } from "../../shared";
import { isCheckboxEvent } from "../utils/checkboxEvent";

type SelectionCellProps = {
  /** 選択の on / off(off = 幅 0 で隠す。出入りは動く) @default true */
  visible?: boolean;
  label: string;
  rowIndex: number;
  isCheckboxSelection: boolean;
  isSelected: boolean;
  /** 選べない行(チェックを押せない)。未指定 = 押せる */
  disabled?: boolean;
  onToggle: (checked?: boolean, shiftKey?: boolean) => void;
};

export function SelectionCell({
  visible = true,
  label,
  rowIndex,
  isCheckboxSelection,
  isSelected,
  disabled,
  onToggle,
}: SelectionCellProps) {
  // チェックのクリックの shift を onCheckedChange へ渡す(onCheckedChange はイベントを持たない)
  const shiftKeyRef = React.useRef(false);
  const handleCellClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isCheckboxSelection || !visible) {
      return;
    }
    event.stopPropagation();
    if (isCheckboxEvent(event) || disabled) {
      return;
    }
    onToggle(undefined, event.shiftKey);
  };

  return (
    <TableCell
      className={cn(
        "transition-[padding] duration-200 ease-linear",
        visible ? "w-10" : "w-0 px-0",
        visible && isCheckboxSelection && "cursor-pointer select-none",
      )}
      onClick={isCheckboxSelection && visible ? handleCellClick : undefined}
      inert={!visible}
      aria-hidden={visible ? undefined : true}
    >
      <Flex
        align="center"
        justify="center"
        className={cn(
          "h-full overflow-hidden transition-[width,opacity] duration-200 ease-linear",
          visible ? "w-10 opacity-100" : "w-0 opacity-0",
        )}
      >
        <Checkbox
          data-table-checkbox-root="true"
          aria-label={`${label}${rowIndex + 1}行`}
          checked={isSelected}
          disabled={disabled}
          onCheckedChange={(checked) => onToggle(checked === true, shiftKeyRef.current)}
          onClick={(event) => {
            shiftKeyRef.current = event.shiftKey;
            event.stopPropagation();
          }}
        />
      </Flex>
    </TableCell>
  );
}
