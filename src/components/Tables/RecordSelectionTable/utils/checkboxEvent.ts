import React from "react";

export const isCheckboxEvent = (event: React.MouseEvent<HTMLElement>) => {
  const target = event.target as HTMLElement | null;
  return Boolean(target?.closest("[data-table-checkbox-root]"));
};
