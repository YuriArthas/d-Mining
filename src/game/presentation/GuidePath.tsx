import { useEffect, useMemo, type RefObject } from 'react';
import { Group, MeshBasicMaterial } from 'three';
import { chevronGeometry, GUIDE_CHEVRONS, markerGeometry } from './guidePath.ts';

/** The first-dig guide's objects (guidePath.ts lays them out each frame). */
export function GuidePath({ pathRef }: { pathRef: RefObject<Group | null> }) {
  const resources = useMemo(() => ({ chevron: chevronGeometry(), marker: markerGeometry(), material: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }) }), []);
  useEffect(() => () => { resources.chevron.dispose(); resources.marker.dispose(); resources.material.dispose(); }, [resources]);
  // Hidden until the first-dig tip needs it; `prewarm` has loading compile its shader anyway (prepareShaders).
  return <group ref={pathRef} name="onboarding-path" visible={false} userData={{ style: 'chevrons-v1', prewarm: true }}>
    <instancedMesh args={[resources.chevron, resources.material, GUIDE_CHEVRONS]} frustumCulled={false} />
    <mesh geometry={resources.marker} material={resources.material} />
  </group>;
}
