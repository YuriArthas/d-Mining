import type {
  SessionContent,
  Destination,
} from "../application/SessionContent.ts";
import { ROOMS, HOME_ZONE, SURFACE_SELL, type RestRoom } from "./rooms.ts";
import { SURFACE_SHOP } from "./surfaceLayout.ts";
import { PET_CONTENT } from "../content/pets.ts";
import { PET_DISPLAYS, SURFACE_PORTALS } from "./SurfaceHub.ts";
export function sessionContentFor(
  rooms: readonly RestRoom[],
  portals: SessionContent["portals"],
  surface: {
    sale: SessionContent["sales"][number];
    shop: SessionContent["shops"][number]["zone"];
    home: SessionContent["home"];
  },
): SessionContent {
  const ids = new Set<string>();
  for (const room of rooms) {
    if (ids.has(room.id)) throw Error("重复目的地: " + room.id);
    ids.add(room.id);
  }
  for (const portal of portals)
    if (!ids.has(portal.id)) throw Error("未知传送目的地: " + portal.id);
  return {
    initialCoins: 200,
    petContent: PET_CONTENT,
    eggStations: PET_DISPLAYS.map(display => ({
      id: display.id,
      eggId: display.eggId,
      promptAnchor: [display.x, display.y + 4.85, display.z] as const,
      zone: { x: display.x - 2, y: display.y, z: display.z, radius: 1.3, heightTolerance: .35, hysteresis: .3 },
    })),
    destinations: rooms,
    sales: [surface.sale, ...rooms.map((r) => r.sell)],
    shops: [
      { id: "surface-upgrade", zone: surface.shop },
      ...rooms.filter((r) => r.shop).map((r) => ({ id: r.id, zone: r.shop! })),
    ],
    portals,
    home: surface.home,
  };
}
export const SESSION_CONTENT = sessionContentFor(ROOMS, SURFACE_PORTALS, {
  sale: SURFACE_SELL,
  shop: SURFACE_SHOP,
  home: HOME_ZONE,
});
