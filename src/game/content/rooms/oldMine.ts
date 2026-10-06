import definition from './oldMine.scene.json' with {type:'json'};
import type {RoomSceneDefinition} from './authoredRoom.ts';
// Editable scene metadata; geometry/layout are registered separately to keep workers small.
export const OLD_MINE_SCENE = definition as RoomSceneDefinition;
