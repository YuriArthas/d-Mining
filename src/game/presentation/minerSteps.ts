import { AnimationMixer, Vector3, type AnimationClip, type Object3D } from 'three';

const SAMPLES = 64;
/** The foot plants a little after it reaches furthest forward. */
const PLANT_DELAY = 0.03;

/** Phases (0..1) of a locomotion clip where each foot plants, found by sampling the clip: a foot
 *  plants just after its furthest-forward point (the avatar faces -Z). Restores the rig afterwards. */
export function footContacts(root: Object3D, clip: AnimationClip, feet: readonly string[] = ['LeftFoot', 'RightFoot']) {
  const bones = feet.map(name => root.getObjectByName(name));
  if (bones.some(bone => !bone)) throw Error('矿工模型缺少脚部骨骼');
  const mixer = new AnimationMixer(root), action = mixer.clipAction(clip).play(), position = new Vector3();
  const forward = bones.map(() => ({ z: Infinity, phase: 0 }));
  try {
    for (let i = 0; i < SAMPLES; i++) {
      action.time = clip.duration * i / SAMPLES;
      mixer.update(0);
      root.updateMatrixWorld(true);
      bones.forEach((bone, b) => {
        const z = bone!.getWorldPosition(position).z;
        if (z < forward[b].z) forward[b] = { z, phase: i / SAMPLES };
      });
    }
  } finally {
    action.stop(); mixer.uncacheRoot(root); root.updateMatrixWorld(true);
  }
  return forward.map(f => (f.phase + PLANT_DELAY) % 1).sort((a, b) => a - b);
}

/** Whether a looping phase moved past `contact` going from `from` to `to` (wrapping at 1). */
export function crossed(from: number, to: number, contact: number) {
  return to >= from ? from < contact && contact <= to : contact > from || contact <= to;
}
