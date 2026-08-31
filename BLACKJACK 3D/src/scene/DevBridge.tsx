import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/**
 * Dev-only: exposes the live scene so geometry can be measured from the console
 * (model scale, orientation, where things actually sit on the felt). Stripped
 * from production builds by the import.meta.env.DEV guard at the call site.
 */
export default function DevBridge() {
  const { scene, camera, gl } = useThree()

  useEffect(() => {
    ;(window as any).__bj = { scene, camera, gl }
    return () => {
      delete (window as any).__bj
    }
  }, [scene, camera, gl])

  return null
}
