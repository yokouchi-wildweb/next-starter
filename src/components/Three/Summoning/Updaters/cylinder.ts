// src/components/Three/Summoning/Updaters/cylinder.ts

import * as THREE from "three";
import { settings } from "../settings";

export function updateCylinder(cylinder: THREE.Mesh, t: number) {
  const end = settings.cylinder.start + settings.cylinder.growDuration;
  if (t < settings.cylinder.start) {
    cylinder.visible = false;
  } else if (t < end) {
    const p = (t - settings.cylinder.start) / settings.cylinder.growDuration;
    cylinder.visible = true;
    cylinder.scale.set(1, p, 1);
  } else {
    cylinder.visible = true;
    cylinder.scale.set(1, 1, 1);
  }
  if (t >= settings.cylinder.start) {
    let speed = settings.cylinder.rotationSpeed;
    if (t > settings.camera.switch) {
      speed += (t - settings.camera.switch) * settings.cylinder.accel;
    }
    cylinder.rotation.y += speed;
  }

  const mat = cylinder.material as THREE.ShaderMaterial;
  const startColor = new THREE.Color(settings.cylinder.startColor);
  const endColor = new THREE.Color(settings.cylinder.endColor);
  const begin = settings.cylinder.colorChangeStart;
  const finish = settings.cylinder.colorChangeEnd;
  if (finish > begin) {
    const pColor = Math.min(Math.max((t - begin) / (finish - begin), 0), 1);
    const col = startColor.clone().lerp(endColor, pColor);
    (mat.uniforms.color.value as THREE.Color).copy(col);
  } else {
    (mat.uniforms.color.value as THREE.Color).copy(startColor);
  }
}
