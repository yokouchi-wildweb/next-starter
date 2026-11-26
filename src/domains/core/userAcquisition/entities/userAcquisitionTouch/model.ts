// src/domains/core/userAcquisition/entities/userAcquisitionTouch/model.ts

import type { AcquisitionExtras } from "../userAcquisition/model";

/** user_acquisition_touches（1:N 明細）の 1 レコード */
export type UserAcquisitionTouch = {
  id: string;
  userId: string;
  touchIndex: number;
  occurredAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  landingPage: string | null;
  extras: AcquisitionExtras | null;
  createdAt: Date;
};
