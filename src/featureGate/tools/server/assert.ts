// src/featureGate/tools/server/assert.ts
// gate.assert(name): 機能が閉じていれば DomainError(404、決まった文言)を投げる。開いていれば何もしない。
// 文言・details に機能の名前は出さない(閉じた機能の存在を利用者に知らせない)。未知の名前は gate.enabled と同じく throw

import { DomainError } from "@/lib/errors";

import { isFeatureEnabled } from "../../evaluate";
import type { FeatureName } from "../../types";

/** 閉じた機能を呼んだときの文言(機能の名前を含めない) */
export const CLOSED_FEATURE_MESSAGE = "お探しのページは見つかりませんでした";

export const assert = (name: FeatureName): void => {
  if (!isFeatureEnabled(name)) throw new DomainError(CLOSED_FEATURE_MESSAGE, { status: 404 });
};
