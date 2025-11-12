"use client";

import { APP_HEADER_ELEMENT_ID } from "@/constants/layout";

import { useElementHeight } from "./useElementHeight";

export const useHeaderHeight = (elementId: string = APP_HEADER_ELEMENT_ID) => {
  return useElementHeight(elementId);
};
