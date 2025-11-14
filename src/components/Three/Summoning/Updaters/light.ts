// src/components/Three/Summoning/Updaters/light.ts

import * as THREE from "three";
import { settings } from "../settings";

export function updateLight(light: THREE.PointLight, t: number) {
  if (t >= settings.light.start && t < settings.light.full) {
    const p =
      (t - settings.light.start) / (settings.light.full - settings.light.start);
    light.intensity = p * 5;
  } else if (t >= settings.light.full) {
    light.intensity = 5;
  }
}
