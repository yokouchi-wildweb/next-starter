import React from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";

import { Checkbox } from "@/components/_shadcn/checkbox";
import { cn } from "@/lib/cn";

import { TableHead } from "@/lib/tableSuite/DataTable/components";
import { isCheckboxEvent } from "../utils/checkboxEvent";

type SelectionHeaderCellProps = {
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
  label,
  isCheckboxSelection,
  checked,
  indeterminate,
  onToggle,
  onRequestToggle,
}: SelectionHeaderCellProps) {
  const handleCellClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isCheckboxSelection) {
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
      className={cn("w-10", isCheckboxSelection && "cursor-pointer select-none")}
      onClick={isCheckboxSelection ? handleCellClick : undefined}
    >
      <div className="flex h-full w-full items-center justify-center">
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
