import type { V3, Solid } from '../../world/sceneryKit.ts';

export type RoomAnchor = 'room' | 'spawn' | 'sell' | 'shop';
export type RoomZone = {at: number[]; radius: number; heightTolerance: number; hysteresis: number};
export type RoomFacilities = {spawn: {at: number[]; clearance: number}; sell: RoomZone; shop: RoomZone | null};
export type RoomRenderStyle = {
  atlas: {columns: number; rows: number; gutter: number; repeat: number};
  surface: {roughness: number; metalness: number; envMapIntensity: number; glowIntensity: number};
  lighting: {
    resolution: number; lampStrength: number; horizontalFalloff: number;
    color: number[]; height: number; verticalFalloff: number;
    ceiling: {bottomBrightness: number; topBrightness: number; from: number; to: number};
    contact: {floorThreshold: number; maxHalfHeight: number; strength: number; falloff: number; fadeFrom: number; fadeTo: number};
  };
};
// Lightweight metadata: safe for gameplay and voxel workers. Never imports meshes.
export type RoomSceneDefinition = {
  asset: string;
  referenceSize: number[];
  facilities: RoomFacilities;
  signs: {anchor: RoomAnchor; offset: number[]; width: number; title: string; subtitle: string; color: string; background: string}[];
  rings: {anchor: 'sell' | 'shop'; offset: number[]; height: number; color: string; glow: boolean}[];
  render: RoomRenderStyle;
};
export type RoomInstance = {
  name: string; mesh: string; material: string;
  at: number[]; scale: number[]; rotation: number[]; fixed: boolean; floor?: string;
};
export type RoomLamp = {at: number[]; fixed: boolean};
export type RoomMaterial = {color: string; tile: number; glow: boolean};
export type RoomKit = {
  id: string;
  meshes: Record<string, {positions:number[]; normals:number[]; uv:number[]; indices:number[]}>;
  texture: {size:number; data:string};
};
export type RoomLayoutData = {
  textureSize: number;
  materials: Record<string, RoomMaterial>;
  groups: {
    id: string; anchor: RoomAnchor; offset: number[];
    instances: RoomInstance[];
    solids: {at:number[]; half:number[]; yaw:number; fixed:boolean}[];
    lamps: RoomLamp[];
  }[];
};
export type RoomSceneAsset = {kit: RoomKit; layout: RoomLayoutData};
export type AuthoredRoom = {
  kit: RoomKit;
  materials: RoomLayoutData['materials'];
  render: RoomRenderStyle;
  referenceSize: number[];
  // Positions remain in canonical room metres until the renderer applies this transform.
  origin: V3; scale: V3;
  instances: readonly RoomInstance[];
  lightSolids: readonly Solid[];
  lamps: readonly number[][];
};
