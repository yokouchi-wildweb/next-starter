// src/components/Three/Summoning/Updaters/ring.ts

import * as THREE from "three";
import { settings } from "../settings";

export function updateRing(ring: THREE.Mesh, t: number) {
  const end = settings.ring.start + settings.ring.appearDuration;
  if (t < settings.ring.start) {
    ring.visible = false;
  } else if (t < end) {
    const p = (t - settings.ring.start) / settings.ring.appearDuration;
    ring.visible = true;
    ring.scale.setScalar(p);
  } else {
    ring.visible = true;
    ring.scale.setScalar(1);
  }

  const mat = ring.material as THREE.ShaderMaterial;
  const startColor = new THREE.Color(settings.ring.startColor);
  const endColor = new THREE.Color(settings.ring.endColor);
  const begin = settings.ring.colorChangeStart;
  const finish = settings.ring.colorChangeEnd;
  if (finish > begin) {
    const pColor = Math.min(Math.max((t - begin) / (finish - begin), 0), 1);
    const col = startColor.clone().lerp(endColor, pColor);
    (mat.uniforms.color.value as THREE.Color).copy(col);
  } else {
    (mat.uniforms.color.value as THREE.Color).copy(startColor);
  }
}
