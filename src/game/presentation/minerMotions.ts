import { AnimationClip, Euler, MathUtils, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type Object3D } from 'three';

/** Hand-authored miner motions (the RAB library has no pickaxe swing and only slow jump clips).
 *  Every bone of Miner A rests at identity with model axes: +X right, +Y up, -Z forward. A pose is
 *  therefore a local Euler rotation in degrees (three.js 'XYZ'): +X swings a hanging limb forward
 *  and up but tips the torso and head back, +Y turns toward the miner's left, +Z lifts the right
 *  arm outward (the left arm inward). Poses read the rig only for leg lengths, so feet stay planted. */
const MINER_BONES = [
  'Root', 'LowerTorso', 'UpperTorso', 'Head',
  'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'RightUpperLeg', 'RightLowerLeg', 'RightFoot',
] as const;
type MinerBone = (typeof MINER_BONES)[number];
export const UPPER_BODY = new Set<string>(['UpperTorso', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand']);

type Rotation = readonly [x: number, y: number, z: number];
type Pose = Readonly<Partial<Record<MinerBone, Rotation>>>;
type Key = Readonly<{ at: number; pose: Pose; ease?: (t: number) => number }>;

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Phase of the pick's contact within one swing; the hit itself lands when the swing starts. */
export const SWING_IMPACT = 0.24;

// One swing, normalised to a 1 s clip that the mining layer stretches over the attack period:
// carry the pick at the ready, raise it high behind the head, snap it down into the target, hold, recover.
const READY: Pose = {
  UpperTorso: [-3, -6, 0], Head: [3, 6, 0],
  RightUpperArm: [28, 0, 10], RightLowerArm: [48, 0, 0], RightHand: [-42, 0, 0],
  LeftUpperArm: [10, 0, -10], LeftLowerArm: [30, 0, 0], LeftHand: [0, 0, 0],
};
const WINDUP: Pose = {
  UpperTorso: [10, -22, 3], Head: [-8, 18, -2],
  RightUpperArm: [178, 0, 8], RightLowerArm: [22, 0, 0], RightHand: [-12, 0, 0],
  LeftUpperArm: [40, 0, -12], LeftLowerArm: [40, 0, 0], LeftHand: [0, 0, 0],
};
// World pick angle = torso + shoulder + elbow + wrist about X: about 50 degrees at contact keeps the
// handle rising from the fist and drives the point forward-down into a block at chest height.
const IMPACT: Pose = {
  UpperTorso: [-12, 14, -3], Head: [10, -12, 2],
  RightUpperArm: [72, 0, 6], RightLowerArm: [6, 0, 0], RightHand: [-16, 0, 0],
  LeftUpperArm: [-24, 0, -14], LeftLowerArm: [22, 0, 0], LeftHand: [0, 0, 0],
};
const FOLLOW: Pose = {
  UpperTorso: [-15, 16, -3], Head: [12, -13, 2],
  RightUpperArm: [62, 0, 6], RightLowerArm: [10, 0, 0], RightHand: [-20, 0, 0],
  LeftUpperArm: [-26, 0, -14], LeftLowerArm: [24, 0, 0], LeftHand: [0, 0, 0],
};
const RECOIL: Pose = { ...FOLLOW, UpperTorso: [-13, 15, -3], RightUpperArm: [66, 0, 6], RightHand: [-18, 0, 0] };
const SWING: readonly Key[] = [
  { at: 0, pose: READY },
  { at: 0.15, pose: WINDUP, ease: easeOut },
  { at: SWING_IMPACT, pose: IMPACT, ease: easeIn },
  { at: 0.32, pose: FOLLOW, ease: easeOut },
  { at: 0.45, pose: RECOIL, ease: easeInOut },
  { at: 1, pose: READY, ease: easeInOut },
];

// A drill (the mixer) is held out level at chest height in the right fist, the left hand steadying its body, and
// shoved a little further in on each hit. The clip starts and ends on the hold so back-to-back hits never drop the
// arms; the shaking on top is procedural (MinerAvatar), at a fixed rate whatever the attack speed.
const DRILL_HOLD: Pose = {
  UpperTorso: [-4, -8, 0], Head: [4, 8, 0],
  RightUpperArm: [50, 37, -55], RightLowerArm: [13, 0, 0], RightHand: [32, 31, 39],
  LeftUpperArm: [38, -80, -26], LeftLowerArm: [52, 0, 0], LeftHand: [0, 0, 0],
};
const DRILL_PUSH: Pose = { ...DRILL_HOLD, UpperTorso: [-10, -9, 0], Head: [10, 9, 0], RightUpperArm: [56, 37, -55], LeftUpperArm: [44, -80, -26] };
const DRILL: readonly Key[] = [
  { at: 0, pose: DRILL_HOLD },
  { at: SWING_IMPACT, pose: DRILL_PUSH, ease: easeOut },
  { at: 0.55, pose: DRILL_HOLD, ease: easeInOut },
  { at: 1, pose: DRILL_HOLD },
];

// Air poses: knee tucked on the way up, arms thrown out on the way down, a short crouch on landing.
const RISE: Pose = {
  LowerTorso: [6, 0, 0], UpperTorso: [-6, 0, 0], Head: [6, 0, 0],
  LeftUpperArm: [155, 0, -18], LeftLowerArm: [18, 0, 0], LeftHand: [0, 0, 0],
  RightUpperArm: [72, 0, 14], RightLowerArm: [50, 0, 0], RightHand: [-30, 0, 0],
  RightUpperLeg: [62, 0, 4], RightLowerLeg: [-96, 0, 0], RightFoot: [26, 0, 0],
  LeftUpperLeg: [-10, 0, -3], LeftLowerLeg: [-34, 0, 0], LeftFoot: [16, 0, 0],
};
const FALL: Pose = {
  LowerTorso: [-4, 0, 0], UpperTorso: [4, 0, 0], Head: [-4, 0, 0],
  LeftUpperArm: [70, 0, -95], LeftLowerArm: [30, 0, 0], LeftHand: [0, 0, 0],
  RightUpperArm: [70, 0, 80], RightLowerArm: [40, 0, 0], RightHand: [-20, 0, 0],
  RightUpperLeg: [30, 0, 6], RightLowerLeg: [-50, 0, 0], RightFoot: [14, 0, 0],
  LeftUpperLeg: [-12, 0, -6], LeftLowerLeg: [-30, 0, 0], LeftFoot: [12, 0, 0],
};
const LAND_UPPER: Pose = {
  UpperTorso: [-16, 0, 0], Head: [12, 0, 0],
  LeftUpperArm: [-14, 0, -26], LeftLowerArm: [34, 0, 0], LeftHand: [0, 0, 0],
  RightUpperArm: [34, 0, 22], RightLowerArm: [52, 0, 0], RightHand: [0, 0, 0],
};
const LAND = { drop: 0.13, pelvis: -8 } as const;

const DEG = Math.PI / 180;
const quaternion = ([x, y, z]: Rotation) => new Quaternion().setFromEuler(new Euler(x * DEG, y * DEG, z * DEG, 'XYZ'));

function bone(rig: Object3D, name: MinerBone) {
  const found = rig.getObjectByName(name);
  if (!found) throw Error(`矿工骨骼缺失：${name}`);
  return found;
}

/** Sagittal two-bone solve: hip and knee angles that put the ankle at `target` (y, z) in the
 *  pelvis frame. Angles follow the local +X rotation sign used by the poses. */
function solveLeg(thigh: Vector3, shin: Vector3, target: readonly [number, number]) {
  const angle = (y: number, z: number) => Math.atan2(z, y);
  const lt = Math.hypot(thigh.y, thigh.z), ls = Math.hypot(shin.y, shin.z);
  const reach = MathUtils.clamp(Math.hypot(...target), Math.abs(lt - ls) + 1e-4, lt + ls - 1e-4);
  const between = angle(shin.y, shin.z) - angle(thigh.y, thigh.z);
  // Choose the knee solution that folds the shin backward (negative local X).
  const knee = -Math.acos(MathUtils.clamp((reach * reach - lt * lt - ls * ls) / (2 * lt * ls), -1, 1)) - between;
  const ky = thigh.y + shin.y * Math.cos(knee) - shin.z * Math.sin(knee), kz = thigh.z + shin.y * Math.sin(knee) + shin.z * Math.cos(knee);
  const hip = angle(target[0], target[1]) - angle(ky, kz);
  return { hip, knee };
}

/** Landing crouch: pelvis lowered by LAND.drop with both feet held at their rest positions. */
function landingPose(rig: Object3D) {
  const pose: Record<string, Quaternion> = {};
  const pelvis = LAND.pelvis * DEG, unpitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -pelvis);
  for (const side of ['Left', 'Right'] as const) {
    const hip = bone(rig, `${side}UpperLeg`).position, thigh = bone(rig, `${side}LowerLeg`).position, shin = bone(rig, `${side}Foot`).position;
    // Rest ankle relative to the rest pelvis; after the drop, express it in the tilted pelvis frame.
    const ankle = hip.clone().add(thigh).add(shin);
    const tiltedHip = hip.clone().applyAxisAngle(new Vector3(1, 0, 0), pelvis);
    const local = ankle.clone().setY(ankle.y + LAND.drop).sub(tiltedHip).applyQuaternion(unpitch);
    const { hip: flex, knee } = solveLeg(thigh, shin, [local.y, local.z]);
    pose[`${side}UpperLeg`] = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), flex);
    pose[`${side}LowerLeg`] = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), knee);
    pose[`${side}Foot`] = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -(pelvis + flex + knee));
  }
  pose.LowerTorso = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pelvis);
  for (const [name, rotation] of Object.entries(LAND_UPPER)) pose[name] = quaternion(rotation);
  return pose;
}

function staticClip(name: string, pose: Record<string, Quaternion>, extra: VectorKeyframeTrack[] = []) {
  const tracks = Object.entries(pose).map(([bone, q]) => new QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [...q.toArray(), ...q.toArray()]));
  return new AnimationClip(name, 1, [...tracks, ...extra]);
}

/** Dense keys so each segment keeps its own easing when the clip is time-stretched. */
function keyedClip(name: string, keys: readonly Key[], samples = 120) {
  const bones = [...new Set(keys.flatMap(k => Object.keys(k.pose)))] as MinerBone[];
  const resolved = keys.map(k => Object.fromEntries(bones.map(b => [b, quaternion(k.pose[b] ?? [0, 0, 0])])));
  const times = Array.from({ length: samples + 1 }, (_, i) => i / samples);
  const scratch = new Quaternion();
  const tracks = bones.map(b => new QuaternionKeyframeTrack(`${b}.quaternion`, times, times.flatMap(t => {
    const next = Math.max(1, keys.findIndex(k => k.at >= t));
    const from = keys[next - 1], to = keys[next];
    const local = MathUtils.clamp((t - from.at) / Math.max(1e-6, to.at - from.at), 0, 1);
    return scratch.slerpQuaternions(resolved[next - 1][b], resolved[next][b], (to.ease ?? easeInOut)(local)).toArray();
  })));
  return new AnimationClip(name, 1, tracks);
}

export function createMinerMotions(rig: Object3D) {
  const root = bone(rig, 'Root').position;
  const toQuaternions = (pose: Pose) => Object.fromEntries(Object.entries(pose).map(([b, r]) => [b, quaternion(r)]));
  return {
    swing: keyedClip('Swing', SWING),
    drill: keyedClip('Drill', DRILL),
    rise: staticClip('Rise', toQuaternions(RISE)),
    fall: staticClip('Fall', toQuaternions(FALL)),
    land: staticClip('Land', landingPose(rig), [new VectorKeyframeTrack('Root.position', [0, 1], [root.x, root.y - LAND.drop, root.z, root.x, root.y - LAND.drop, root.z])]),
  };
}
