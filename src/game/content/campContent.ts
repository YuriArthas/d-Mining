import { createSurfaceDetailContent, type SurfaceDetailContent } from './surfaceDetails.ts';
import { roomPlan } from '../world/scenery.ts';
import { MATERIAL_PRESETS, type MaterialPresets } from "./materialPresets.ts";
import { PORTAL_SLOTS, type PortalSlot } from "./portalSlots.ts";
import { LAYERS, validateLayers, type Layer } from "./layers.ts";
import { ASSET_PROFILES } from "./assetProfiles.ts";
import { ENVIRONMENT_CONFIG } from "../world/environment.ts";
import { ROOMS, roomsFor } from "../world/rooms.ts";
import {
  SURFACE_PORTALS,
  portalsFor,
  portalPlacementsFor,
  PET_DISPLAYS,
  PORTAL_BASE_HEIGHT,
} from "../world/SurfaceHub.ts";
import { SESSION_CONTENT, sessionContentFor } from "../world/sessionContent.ts";
import {
  SURFACE_SALE,
  SURFACE_SHOP,
  SURFACE_HOME,
  SURFACE_SPAWN,
} from "../world/surfaceLayout.ts";
import {
  QUARRY_PLACEMENTS,
  QUARRY_PORTAL_SOLIDS,
  hubSolidsFor,
} from "../world/QuarryLayout.ts";
import { surfacePlan } from "../world/SurfaceAssetPlan.ts";
import { ENTRANCE_WORLD } from "../world/entrance.ts";
import type { QuarryPlacement } from "../world/QuarryLayout.ts";
import type { SceneryPlan } from "../world/sceneryKit.ts";
import type { AssetProfile } from "./assetProfiles.ts";

export type SurfaceContent = Readonly<{
  details: SurfaceDetailContent;
  placements: readonly QuarryPlacement[];
  plan: SceneryPlan;
  profiles: Readonly<Record<string, AssetProfile>>;
  materials: MaterialPresets;
  shaft: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
}>;
// Composition of authored data and deterministic plans. No engine objects or callbacks.
export function createCampContent(
  layers: readonly Layer[] = LAYERS,
  slots: Readonly<Record<string, PortalSlot>> = PORTAL_SLOTS,
) {
  validateLayers(layers);
  const rooms = layers === LAYERS ? ROOMS : roomsFor(layers),
    portals =
      layers === LAYERS && slots === PORTAL_SLOTS
        ? SURFACE_PORTALS
        : portalsFor(layers, slots);
  for (const room of rooms) roomPlan(room);
  const session =
    layers === LAYERS && slots === PORTAL_SLOTS
      ? SESSION_CONTENT
      : sessionContentFor(rooms, portals, {
          sale: SURFACE_SALE,
          shop: SURFACE_SHOP,
          home: SURFACE_HOME,
        });
  const placements =
    layers === LAYERS && slots === PORTAL_SLOTS
      ? QUARRY_PLACEMENTS
      : [
          ...QUARRY_PLACEMENTS.filter((p) => !p.portalId),
          ...portalPlacementsFor(portals),
        ];
  const plan = surfacePlan();
  if (layers !== LAYERS || slots !== PORTAL_SLOTS) {
    const oldPortalSolids = new Set(QUARRY_PORTAL_SOLIDS);
    plan.solids = [
      ...plan.solids.filter((s) => !oldPortalSolids.has(s)),
      ...hubSolidsFor(portalPlacementsFor(portals)),
    ];
  }
  const surface: SurfaceContent = {
    details: createSurfaceDetailContent(),
    placements,
    plan,
    profiles: ASSET_PROFILES,
    materials: MATERIAL_PRESETS,
    shaft: ENTRANCE_WORLD,
  };
  for (const p of surface.placements) {
    const profile = surface.profiles[p.asset];
    if (!profile) throw Error(`缺少资源配置 ${p.asset}`);
    if (!["standard", "block", "lens", "badge"].includes(profile.material))
      throw Error(`未知材质策略 ${p.asset}`);
    for (const value of [
      profile.roughness,
      profile.metalness,
      profile.envMapIntensity,
    ])
      if (value !== undefined && (!Number.isFinite(value) || value < 0))
        throw Error(`无效材质参数 ${p.asset}`);
    if (
      ![
        p.x,
        p.z,
        p.width,
        p.y ?? 0,
        p.yaw ?? 0,
        p.height ?? 1,
        p.depth ?? 1,
      ].every(Number.isFinite) ||
      p.width <= 0 ||
      (p.height ?? 1) <= 0 ||
      (p.depth ?? 1) <= 0
    )
      throw Error(`无效场景实例 ${p.asset}`);
  }
  return {
    layers,
    rooms,
    session,
    surface,
    environment: ENVIRONMENT_CONFIG,
    returnPoint: SURFACE_SPAWN,
    hub: { portals, eggs: PET_DISPLAYS, baseHeight: PORTAL_BASE_HEIGHT },
  };
}
export type CampContent = ReturnType<typeof createCampContent>;
export const CAMP_CONTENT = createCampContent();
