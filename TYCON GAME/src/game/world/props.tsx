/**
 * CITY EMPIRE — Reusable world props.
 *
 * Small, data-light building blocks for the district: buildings with
 * procedural window facades, trees, and street lights. Everything is
 * procedural geometry — no external meshes (see project decision to build
 * web-3D visuals in code).
 */

import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { makeFacadeTexture } from './textures';

interface BuildingProps {
  position: [number, number, number];
  /** [width, height, depth] in meters. */
  size: [number, number, number];
  wall: string;
  roof?: string;
  rotation?: number;
  litRatio?: number;
}

/** A city building: box body with windowed facades + a flat roof slab. */
export function Building({
  position,
  size,
  wall,
  roof = '#3a3f47',
  rotation = 0,
  litRatio = 0,
}: BuildingProps) {
  const [w, h, d] = size;

  const materials = useMemo(() => {
    const cols = Math.max(2, Math.round(w / 1.6));
    const rowsWide = Math.max(2, Math.round(h / 1.6));
    const colsDepth = Math.max(2, Math.round(d / 1.6));

    const facadeWide = makeFacadeTexture({ wall, cols, rows: rowsWide, litRatio });
    const facadeDepth = makeFacadeTexture({ wall, cols: colsDepth, rows: rowsWide, litRatio });

    const wideMat = new MeshStandardMaterial({ map: facadeWide, roughness: 0.85 });
    const depthMat = new MeshStandardMaterial({ map: facadeDepth, roughness: 0.85 });
    const roofMat = new MeshStandardMaterial({ color: roof, roughness: 0.9 });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    return [depthMat, depthMat, roofMat, roofMat, wideMat, wideMat];
  }, [w, h, d, wall, roof, litRatio]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow material={materials}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* Roof lip for a little silhouette detail. */}
      <mesh position={[0, h + 0.06, 0]} castShadow>
        <boxGeometry args={[w + 0.25, 0.12, d + 0.25]} />
        <meshStandardMaterial color={roof} roughness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * Simple stylized tree: trunk + two foliage blobs.
 *
 * No castShadow here — decorative props don't need to punch shadows for the
 * scene to read correctly, and skipping them cuts shadow-pass draw calls
 * substantially (perf).
 */
export function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1.2, 6]} />
        <meshStandardMaterial color="#5b4632" roughness={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <icosahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#3f7d43" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.25, 2.0, 0.1]}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#4a8c4e" flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * Street light with an emissive lamp head.
 *
 * Deliberately has NO real-time point light: nine dynamic lights across a
 * small street tanked frame rate (each point light re-lights every fragment
 * in the scene). The glow is sold entirely by the emissive material + a
 * small bloom pass in the render pipeline, which costs almost nothing.
 */
export function StreetLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 3.2, 6]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.35, 3.2, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.12]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.62, 3.12, 0]}>
        <sphereGeometry args={[0.13, 10, 10]} />
        <meshStandardMaterial color="#ffe8b0" emissive="#ffcf6b" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A public bench (interactable "Sit" comes later; decorative for now). */
export function Bench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.42]} />
        <meshStandardMaterial color="#6b4f33" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.75, -0.18]}>
        <boxGeometry args={[1.4, 0.4, 0.06]} />
        <meshStandardMaterial color="#6b4f33" roughness={0.9} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]}>
          <boxGeometry args={[0.08, 0.44, 0.4]} />
          <meshStandardMaterial color="#3a2c1c" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
