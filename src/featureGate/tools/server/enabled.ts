// src/featureGate/tools/server/enabled.ts
// gate.enabled(name): 機能が有効か(name = 規則のファイル名、型 FeatureName)。未知の名前は throw

import { isFeatureEnabled } from "../../evaluate";
import type { FeatureName } from "../../types";

export const enabled = (name: FeatureName): boolean => isFeatureEnabled(name);
