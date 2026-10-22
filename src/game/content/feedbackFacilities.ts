// Functional additions beside the entrance and plaza. Authored models may replace
// these small UI fixtures without changing their interaction anchors.
export const CHALLENGE_BOARD_AT = [10.8, 0, 12] as const;
export const CAPSULE_MACHINE_AT = [12, 0, 30] as const;
export const CAPSULE_MACHINE_ZONE = {x:12,y:0,z:31.8,radius:2.2,heightTolerance:.4,hysteresis:.3} as const;
export const FEEDBACK_COLLISION_SITE: import('../presentation/SceneryCollision.ts').ScenerySite = {
  id:'feedback-fixtures',depth:0,plan:{shapes:[],signs:[],solids:[
    {at:[CHALLENGE_BOARD_AT[0],3.4,CHALLENGE_BOARD_AT[2]],half:[2.35,3.4,.18],yaw:0},
    {at:[CAPSULE_MACHINE_AT[0],2.15,CAPSULE_MACHINE_AT[2]],half:[1.25,2.15,1.1],yaw:0},
  ]},
};
