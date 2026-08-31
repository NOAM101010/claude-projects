/**
 * CITY EMPIRE — Player character mesh (MASTER §15, §17).
 *
 * A clean low-poly third-person avatar built procedurally (no external
 * assets). A simple walk cycle animates the limbs based on how fast the
 * player is actually moving, so movement reads as grounded, not floaty.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface Props {
  /** 0 = idle, 1 = full stride. Drives the walk cycle amplitude. */
  strideRef: React.MutableRefObject<number>;
}

const SKIN = '#d9a679';
const SHIRT = '#3b6ea5';
const PANTS = '#2b2f38';
const SHOES = '#14161b';

export function PlayerCharacter({ strideRef }: Props) {
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);

  useFrame((state) => {
    const stride = strideRef.current;
    const t = state.clock.elapsedTime * 9;
    const swing = Math.sin(t) * 0.6 * stride;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
  });

  return (
    <group>
      {/* Torso */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.5, 6, 12]} />
        <meshStandardMaterial color={SHIRT} roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      {/* Hair cap */}
      <mesh position={[0, 1.8, -0.02]} castShadow>
        <sphereGeometry args={[0.235, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#2a2320" roughness={0.9} />
      </mesh>

      {/* Arms (pivot at shoulder) */}
      <group ref={armL} position={[0.34, 1.42, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.44, 4, 8]} />
          <meshStandardMaterial color={SHIRT} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[-0.34, 1.42, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.44, 4, 8]} />
          <meshStandardMaterial color={SHIRT} roughness={0.7} />
        </mesh>
      </group>

      {/* Legs (pivot at hip) */}
      <group ref={legL} position={[0.14, 0.78, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.5, 4, 8]} />
          <meshStandardMaterial color={PANTS} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.72, 0.06]} castShadow>
          <boxGeometry args={[0.16, 0.12, 0.32]} />
          <meshStandardMaterial color={SHOES} roughness={0.5} />
        </mesh>
      </group>
      <group ref={legR} position={[-0.14, 0.78, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.5, 4, 8]} />
          <meshStandardMaterial color={PANTS} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.72, 0.06]} castShadow>
          <boxGeometry args={[0.16, 0.12, 0.32]} />
          <meshStandardMaterial color={SHOES} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
