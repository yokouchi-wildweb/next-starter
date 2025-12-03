// src/features/wallet/services/server/walletService.ts

import { base } from "./drizzleBase";
import { adjustBalance } from "./wrappers/adjustBalance";
import { consumeReservedBalance } from "./wrappers/consumeReservedBalance";
import { releaseReservation } from "./wrappers/releaseReservation";
import { reserveBalance } from "./wrappers/reserveBalance";

export const walletService = {
  ...base,
  adjustBalance,
  reserveBalance,
  releaseReservation,
  consumeReservedBalance,
};
