"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { WALL_H, WALL_W, seededRng } from "./wall-math";

/*
  Decorative backdrop only — never interactive, never the climb surface.
  Procedural low-poly ridge silhouettes far behind the cliff, tinted misty
  blue-grey so the scene fog dissolves them into the horizon.
*/

type Ridge = { z: number; y: number; width: number; height: number; color: string; seed: number };

const RIDGES: Ridge[] = [
  { z: -34, y: -1, width: WALL_W * 6, height: 7, color: "#3a4a63", seed: 11 },
  { z: -46, y: -1.5, width: WALL_W * 10, height: 10, color: "#2b3850", seed: 29 },
];

function ridgeGeometry(r: Ridge): THREE.BufferGeometry {
  const rnd = seededRng(r.seed);
  const segments = 26;
  const half = r.width / 2;
  const baseY = r.y;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const x = -half + (r.width * i) / segments;
    const t = i / segments;
    const env = Math.sin(t * Math.PI); // taper the ends down
    const ridgeLine =
      Math.sin(t * 7 + rnd() * 6) * 0.5 + Math.sin(t * 17 + rnd() * 6) * 0.25 + rnd() * 0.3;
    const y = baseY + env * (r.height * (0.45 + 0.55 * (0.5 + 0.5 * ridgeLine)));
    pts.push(new THREE.Vector2(x, y));
  }
  const shape = new THREE.Shape();
  shape.moveTo(-half, baseY - 6);
  pts.forEach((p) => shape.lineTo(p.x, p.y));
  shape.lineTo(half, baseY - 6);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 1);
}

export default function Mountains() {
  const layers = useMemo(
    () =>
      RIDGES.map((r) => ({
        geo: ridgeGeometry(r),
        mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(r.color), fog: true }),
        z: r.z,
      })),
    []
  );

  useEffect(
    () => () => {
      for (const l of layers) {
        l.geo.dispose();
        l.mat.dispose();
      }
    },
    [layers]
  );

  return (
    <group position={[0, WALL_H * 0.0, 0]}>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geo} material={l.mat} position={[0, 0, l.z]} raycast={() => {}} />
      ))}
    </group>
  );
}
