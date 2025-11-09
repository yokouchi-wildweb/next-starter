"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function StarTunnel() {
  const { camera, gl } = useThree();

  const stars = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const num = 1500;
    const pos = new Float32Array(num * 3);
    for (let i = 0; i < num; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geom;
  }, []);

  const path = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 5;
    const radius = 20;
    const length = 200;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const angle = turns * Math.PI * 2 * t;
      const x = Math.cos(angle) * radius;
      const y = (t - 0.5) * length;
      const z = Math.sin(angle) * radius;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  const colorStops = useMemo(
    () => [new THREE.Color("#1e3a8a"), new THREE.Color("#6b21a8"), new THREE.Color("#d4af37")],
    []
  );
  const progress = useRef(0);

  useFrame((state, delta) => {
    progress.current += delta * 0.05;
    const p = progress.current % 1;
    const pos = path.getPointAt(p);
    const target = path.getPointAt((p + 0.01) % 1);
    camera.position.lerp(pos, 0.1);
    camera.lookAt(target);

    const seg = (colorStops.length - 1) * p;
    const idx = Math.floor(seg);
    const c = colorStops[idx]
      .clone()
      .lerp(colorStops[idx + 1] ?? colorStops[idx], seg - idx);
    gl.setClearColor(c, 1);
  });

  return (
    <>
      <points geometry={stars}>
        <pointsMaterial size={0.5} color={"white"} />
      </points>
      <mesh>
        <tubeGeometry args={[path, 200, 1, 8, false]} />
        <meshBasicMaterial color="white" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

export default function StarTunnelCanvas() {
  return (
    <Canvas className="absolute inset-0 z-0">
      <StarTunnel />
    </Canvas>
  );
}
