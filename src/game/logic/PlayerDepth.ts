type DepthDestination = Readonly<{
  depth: number;
  spawn: readonly number[];
  roomBounds?: Readonly<{
    minX: number; maxX: number; minZ: number; maxZ: number;
    floor: number; ceiling: number;
  }>;
}>;

const CONTACT_DEPTH_TOLERANCE = .04;
const FLOOR_POSITION_EPSILON = .001;

function withinFootprint(feet: readonly number[], bounds: NonNullable<DepthDestination['roomBounds']>) {
  return feet[0] >= bounds.minX && feet[0] < bounds.maxX
    && feet[2] >= bounds.minZ && feet[2] < bounds.maxZ;
}

// Physics leaves feet above the supporting floor. Authored room floor pieces
// can add a few centimetres as well, within the room's spawn clearance.
// Only grounded contact in this narrow floor band earns the room milestone.
export function playerDepthAtFeet(feet: readonly number[], grounded: boolean, destinations: readonly DepthDestination[]) {
  let depth = Math.max(0, -feet[1] + (grounded ? CONTACT_DEPTH_TOLERANCE : 0));
  if (grounded) for (const destination of destinations) {
    const bounds = destination.roomBounds;
    if (bounds && withinFootprint(feet, bounds)
      && feet[1] >= bounds.floor - CONTACT_DEPTH_TOLERANCE
      && feet[1] <= destination.spawn[1] + FLOOR_POSITION_EPSILON) {
      depth = Math.max(depth, destination.depth);
    }
  }
  return depth;
}

// A room keeps its theme throughout its volume, including during a jump.
// This visual depth must never be used to grant progression or travel access.
export function environmentDepthAtFeet(feet: readonly number[], grounded: boolean, destinations: readonly DepthDestination[]) {
  let depth = playerDepthAtFeet(feet, grounded, destinations);
  for (const destination of destinations) {
    const bounds = destination.roomBounds;
    if (bounds && withinFootprint(feet, bounds)
      && feet[1] >= bounds.floor - CONTACT_DEPTH_TOLERANCE && feet[1] < bounds.ceiling) {
      depth = Math.max(depth, destination.depth);
    }
  }
  return depth;
}
