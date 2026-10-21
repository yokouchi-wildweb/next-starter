"use client";

// src/features/core/pairedDevice/hooks/useUnpairThisDevice.ts

import { unpairThisDevice } from "@/features/core/pairedDevice/services/client/pairedDeviceClient";
import { useDomainMutation } from "@/lib/crud/hooks";

import { SESSION_DEVICE_KEY } from "./keys";

/** この端末の登録を解除する mutation フック（DELETE /api/paired-device/session） */
export function useUnpairThisDevice() {
  return useDomainMutation<void, void>(
    "pairedDevice/unpair",
    () => unpairThisDevice(),
    SESSION_DEVICE_KEY,
  );
}
