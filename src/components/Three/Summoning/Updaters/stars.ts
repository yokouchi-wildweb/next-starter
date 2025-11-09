// src/components/Three/Summoning/Updaters/stars.ts

import * as THREE from "three";
import { settings } from "../settings";

const rotationAxis = new THREE.Vector3(...settings.stars.rotationAxis);

export function updateStars(stars: THREE.Points, t: number) {
  let speed = settings.stars.rotationSpeed;
  if (settings.stars.speedChangeTime && t >= settings.stars.speedChangeTime) {
    speed = settings.stars.rotationSpeedAfter;
  }
  stars.rotateOnAxis(rotationAxis, speed);

  const mat = stars.material as THREE.ShaderMaterial;
  const startColor = new THREE.Color(settings.stars.startColor);
  const endColor = new THREE.Color(settings.stars.endColor);
  const begin = settings.stars.colorChangeStart;
  const finish = settings.stars.colorChangeEnd;
  if (finish > begin) {
    const p = Math.min(Math.max((t - begin) / (finish - begin), 0), 1);
    const col = startColor.clone().lerp(endColor, p);
    (mat.uniforms.color.value as THREE.Color).copy(col);
  } else {
    (mat.uniforms.color.value as THREE.Color).copy(startColor);
  }
}
