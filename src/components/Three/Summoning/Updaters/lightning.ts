// src/components/Three/Summoning/Updaters/lightning.ts

import * as THREE from "three";
import { settings } from "../settings";

const lightningEnd =
  settings.lightning.start + settings.lightning.interval * settings.lightning.count;

export function updateLightning(
  lightning: THREE.Mesh,
  spark: THREE.Mesh,
  strikeOffsets: THREE.Vector3[],
  strikeRots: number[],
  t: number,
) {
  if (t >= settings.lightning.start && t < lightningEnd) {
    const cycle = (t - settings.lightning.start) % settings.lightning.interval;
    const index = Math.floor(
      (t - settings.lightning.start) / settings.lightning.interval,
    );
    const active =
      cycle < settings.lightning.active && index < settings.lightning.count;
    lightning.visible = active;
    spark.visible = active;
    if (active && index < settings.lightning.count) {
      const off = strikeOffsets[index];
      if (off) {
        lightning.position.set(off.x, 2, off.z);
        spark.position.set(off.x, 0.01, off.z);
        lightning.rotation.z = strikeRots[index] ?? 0;
      }
    }
  } else {
    lightning.visible = false;
    spark.visible = false;
  }
}
