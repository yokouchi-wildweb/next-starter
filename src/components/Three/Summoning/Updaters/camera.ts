// src/components/Three/Summoning/Updaters/camera.ts

import * as THREE from "three";
import { settings } from "../settings";

export function updateCamera(
  camera: THREE.Camera,
  overlay: THREE.Mesh,
  t: number,
) {
  if (t < settings.camera.switch) {
    camera.position.x = 0;
    camera.position.z = 5 - Math.min(t, settings.camera.preMoveDur) * 0.5;
    camera.position.y = 2.0;
    camera.lookAt(0, 1, 0);
    (overlay.material as THREE.MeshBasicMaterial).opacity = 0;
    overlay.position.set(0, 0, 1);
    overlay.rotation.set(0, 0, 0);
  } else {
    const tt = t - settings.camera.switch;
    const topY = settings.camera.topY;
    if (tt < settings.camera.topDuration) {
      const p = tt / settings.camera.topDuration;
      camera.position.set(0, 1.8 + (topY - 1.8) * p, 3.5 * (1 - p));
    } else {
      const p = Math.min(
        (tt - settings.camera.topDuration) / settings.camera.downDuration,
        1,
      );
      camera.position.set(0, topY - (topY - 0.2) * p, 0);
    }
    camera.lookAt(0, 0, 0);
    const wp = Math.min(
      Math.max(tt - settings.camera.topDuration, 0) /
        settings.camera.downDuration,
      1,
    );
    (overlay.material as THREE.MeshBasicMaterial).opacity = wp;
    overlay.position.copy(camera.position);
    overlay.quaternion.copy(camera.quaternion);
    overlay.translateZ(-0.5);
  }

  const mat = overlay.material as THREE.MeshBasicMaterial;
  const startColor = new THREE.Color(settings.overlay.startColor);
  const endColor = new THREE.Color(settings.overlay.endColor);
  const begin = settings.overlay.colorChangeStart;
  const finish = settings.overlay.colorChangeEnd;
  if (finish > begin) {
    const pColor = Math.min(Math.max((t - begin) / (finish - begin), 0), 1);
    const col = startColor.clone().lerp(endColor, pColor);
    mat.color.copy(col);
  } else {
    mat.color.copy(startColor);
  }
}
