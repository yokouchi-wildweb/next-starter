"use client";

// src/features/core/pairedDevice/hooks/usePairedDeviceKinds.ts

import useSWR, { type SWRConfiguration } from "swr";

import {
  listManageablePairedDeviceKinds,
  type ManageablePairedDeviceKind,
} from "@/features/core/pairedDevice/services/client/pairedDeviceManageClient";

import { PAIRED_DEVICES_KINDS_KEY } from "./keys";

/** このユーザーが管理できる端末の種類（登録フォームの選択肢） */
export function usePairedDeviceKinds(config?: SWRConfiguration<ManageablePairedDeviceKind[]>) {
  return useSWR<ManageablePairedDeviceKind[]>(
    PAIRED_DEVICES_KINDS_KEY,
    listManageablePairedDeviceKinds,
    config,
  );
}
