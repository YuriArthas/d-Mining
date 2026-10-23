// Functional additions on the west side of the plaza: the leaderboard beside the mine entrance
// facing the plaza (+Z), the capsule machine at the bridge exit turned toward the path (+X).
// Authored models may replace these small UI fixtures without changing their interaction anchors.
export const CHALLENGE_BOARD_AT = [-15, 0, 4] as const;
export const CAPSULE_MACHINE_AT = [-11, 0, 30.5] as const;
/** Yaw of the capsule machine's front (0 faces +Z). */
export const CAPSULE_MACHINE_YAW = Math.PI / 2;
const front = (distance: number) => [CAPSULE_MACHINE_AT[0] + Math.sin(CAPSULE_MACHINE_YAW) * distance, CAPSULE_MACHINE_AT[2] + Math.cos(CAPSULE_MACHINE_YAW) * distance] as const;
export const CAPSULE_MACHINE_ZONE = {
  x: front(1.8)[0], y: 0, z: front(1.8)[1], radius: 2.2, heightTolerance: .4, hysteresis: .3,
  lookAt: [CAPSULE_MACHINE_AT[0], 1.5, CAPSULE_MACHINE_AT[2]] as const,
} as const;
export const FEEDBACK_COLLISION_SITE: import('../presentation/SceneryCollision.ts').ScenerySite = {
  id:'feedback-fixtures',depth:0,plan:{shapes:[],signs:[],solids:[
    {at:[CHALLENGE_BOARD_AT[0],3.4,CHALLENGE_BOARD_AT[2]],half:[2.35,3.4,.18],yaw:0},
    {at:[CAPSULE_MACHINE_AT[0],2.15,CAPSULE_MACHINE_AT[2]],half:[1.25,2.15,1.1],yaw:CAPSULE_MACHINE_YAW},
  ]},
};
