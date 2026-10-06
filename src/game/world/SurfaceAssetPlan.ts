import {SURFACE_SERVICES} from './surfaceLayout.ts';
import {SURFACE_SIGNS} from '../content/surfaceSigns.ts';
import {QUARRY_SOLIDS} from './QuarryLayout.ts';
import {CURB_SOLIDS} from './SurfaceRoads.ts';
import {POND_SOLIDS} from './SurfacePonds.ts';
import type {SceneryPlan} from './sceneryKit.ts';
export function surfacePlan():SceneryPlan {
 // Preserve authored draw order. The service descriptors supply both indicators and physics.
 const services=[SURFACE_SERVICES.shop,SURFACE_SERVICES.sale];
 return {solids:[...QUARRY_SOLIDS,...CURB_SOLIDS,...POND_SOLIDS],
  shapes:services.map(p=>p.ring),signs:[...SURFACE_SIGNS,...services.map(p=>p.sign)]};
}
