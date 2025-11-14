// src/components/Three/Summoning/Materials/cylinder.ts
// 上昇する光柱のマテリアルです。波打ち具合や炎の強さを変更して演出を調整できます。

import * as THREE from "three";

export function createCylinderMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      uniform float time;
      varying float vY;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vY = position.y;
        vec3 p = position;
        // wave の振幅を変えると柱表面の揺らぎが変わる
        float wave = sin(p.y * 10.0 + time * 5.0) * 0.03;
        p += normal * wave;
        // flame の値を大きくすると先端の炎が激しくなる
        float flame = smoothstep(0.7, 1.0, uv.y) *
          sin(time * 20.0 + uv.x * 20.0) * 0.05;
        p.y += flame;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying float vY;
      varying vec2 vUv;
      void main() {
        // pulse で柱全体の明滅を制御
        float pulse = sin(time * 2.0 + vY * 4.0) * 0.5 + 0.5;
        // flame は頂点シェーダと連動して燃え上がりを表現
        float flame = smoothstep(0.8, 1.0, vUv.y) *
          abs(sin(time * 20.0 + vUv.x * 30.0));
        vec3 col = color * (1.0 + pulse * 0.5 + flame * 0.5);
        float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        gl_FragColor = vec4(col, fade);
      }
    `,
  });
}
