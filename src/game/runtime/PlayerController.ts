import { FixedStepClock } from "../movement.ts";
import type { CharacterPhysics } from "../validation/physics.ts";
import type { TerrainStream } from "../validation/TerrainStream.ts";
import type { GameInput } from "../GameInput.ts";
import type { GameSession } from "../application/GameSession.ts";
import type { Coord } from "../terrain/SparseWorld.ts";

// Coordinates movement and travel; borrows simulation objects and never disposes them.
export class PlayerController {
  readonly fixed = new FixedStepClock();
  travelling: Coord | null = null;
  facing = 0;
  private readonly physics: CharacterPhysics;
  private readonly terrain: TerrainStream;
  private readonly input: GameInput;
  private readonly session: GameSession;
  constructor(
    physics: CharacterPhysics,
    terrain: TerrainStream,
    input: GameInput,
    session: GameSession,
  ) {
    this.physics = physics;
    this.terrain = terrain;
    this.input = input;
    this.session = session;
  }
  travelTo = (feet: readonly number[]) => {
    this.input.reset();
    this.travelling = [...feet] as unknown as Coord;
    this.terrain.relocate(feet);
    this.fixed.reset();
    this.session.resetPosition();
  };
  step(elapsed: number, yaw: number, onArrived: () => void) {
    let processedTerrain = false;
    this.fixed.advance(elapsed, () => {
      const state = this.input.getSnapshot();
      this.terrain.recenter(this.travelling ?? this.physics.feet());
      // Rapier refreshes queries in step. Never install terrain in a render-only frame.
      if (!processedTerrain) {
        this.terrain.process();
        processedTerrain = true;
      }
      if (this.travelling) {
        if (!this.terrain.ready(this.travelling)) return;
        this.physics.teleport(this.travelling);
        this.travelling = null;
        onArrived();
      }
      this.physics.tick(
        state.moveX,
        state.moveY,
        yaw,
        this.input.consumeJump(),
        this.terrain.ready(this.physics.feet()),
      );
      this.session.updatePosition(this.physics.feet(), this.physics.grounded);
      if (state.moveX || state.moveY)
        this.facing = yaw + Math.atan2(-state.moveX, state.moveY);
    });
  }
}
