// src/components/Three/Summoning/Materials/spark.ts
// 落雷が地面に当たった瞬間の火花を表現するマテリアル。
// フラグメントシェーダの smoothstep の範囲を変更すると火花の広がりを変えられます。

import * as THREE from "three";

export function createSparkMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        // 中心からの距離でフェードさせる
        vec2 uv = vUv - 0.5;
        float d = length(uv) * 2.0;
        // smoothstep のパラメータを変えると火花の範囲が調整可能
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0), a);
      }
    `,
  });
}
