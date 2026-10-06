// Grid dimensions; conversion to metres happens once in room derivation.
export type RoomLayout = Readonly<{
  centerX: number;
  centerZ: number;
  widthCells: number;
  depthCells: number;
  heightCells: number;
}>;
export const ROOM_LAYOUT: RoomLayout = {
  centerX: 0,
  centerZ: 0,
  widthCells: 20,
  depthCells: 20,
  heightCells: 10,
};
