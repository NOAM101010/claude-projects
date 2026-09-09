"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { WALL_H, WALL_W } from "./wall-math";

/*
  Decorative backdrop only — never interactive, never the climb surface.
  The procedural cliff in `cliff.tsx` stays as the surface the climbers hang on;
  these optimised GLBs sit far behind it and are swallowed by the scene fog.
*/
export const HERO_MOUNTAIN_URL = "/models/hero_mountain.glb";
export const BG_MOUNTAIN_URL = "/models/background_mountain.glb";

type Opts = { targetW: number; y: number; z: number; tint: number };

function prep(source: THREE.Object3D, opts: Opts, sink: THREE.Material[]) {
  const root = source.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const s = opts.targetW / (size.x || 1);
  root.scale.setScalar(s);
  root.position.set(-center.x * s, opts.y - center.y * s, opts.z);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.raycast = () => {};
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    const src = m.material as THREE.MeshStandardMaterial;
    if (src && "color" in src) {
      const mat = src.clone();
      mat.color.multiplyScalar(opts.tint);
      mat.metalness = 0;
      mat.roughness = 1;
      m.material = mat;
      sink.push(mat);
    }
  });
  return root;
}

export default function Mountains() {
  const hero = useGLTF(HERO_MOUNTAIN_URL);
  const bg = useGLTF(BG_MOUNTAIN_URL);

  const owned = useMemo<THREE.Material[]>(() => [], []);

  const heroNode = useMemo(
    () => prep(hero.scene, { targetW: WALL_W * 3.6, y: WALL_H * 0.45, z: -7, tint: 0.62 }, owned),
    [hero.scene, owned]
  );
  const bgNode = useMemo(
    () => prep(bg.scene, { targetW: WALL_W * 9, y: WALL_H * 0.5, z: -22, tint: 0.4 }, owned),
    [bg.scene, owned]
  );

  useEffect(() => {
    return () => {
      for (const m of owned) m.dispose();
    };
  }, [owned]);

  return (
    <group>
      <primitive object={bgNode} />
      <primitive object={heroNode} />
    </group>
  );
}

if (typeof window !== "undefined") {
  useGLTF.preload(HERO_MOUNTAIN_URL);
  useGLTF.preload(BG_MOUNTAIN_URL);
}
