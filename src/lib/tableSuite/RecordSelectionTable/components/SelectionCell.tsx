import React from "react";

import { Checkbox } from "@/components/_shadcn/checkbox";
import { cn } from "@/lib/cn";

import { TableCell } from "@/lib/tableSuite/DataTable/components";
import { isCheckboxEvent } from "../utils/checkboxEvent";

type SelectionCellProps = {
  label: string;
  rowIndex: number;
  isCheckboxSelection: boolean;
  isSelected: boolean;
  onToggle: (checked?: boolean) => void;
};

export function SelectionCell({
  label,
  rowIndex,
  isCheckboxSelection,
  isSelected,
  onToggle,
}: SelectionCellProps) {
  const handleCellClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isCheckboxSelection) {
      return;
    }
    event.stopPropagation();
    if (isCheckboxEvent(event)) {
      return;
    }
    onToggle();
  };

  return (
    <TableCell
      className={cn("w-10", isCheckboxSelection && "cursor-pointer select-none")}
      onClick={isCheckboxSelection ? handleCellClick : undefined}
    >
      <div className="flex h-full w-full items-center justify-center">
        <Checkbox
          data-table-checkbox-root="true"
          aria-label={`${label}${rowIndex + 1}行`}
          checked={isSelected}
          onCheckedChange={(checked) => onToggle(checked === true)}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </TableCell>
  );
}
