import type { RegionDataV1 } from "../terrain/WorldSaveCodec.ts";
import type { WorldCaptureToken } from "../terrain/WorldSaveChanges.ts";
// The coordinator can capture and acknowledge world facts, not mine or render them.
export interface WorldSaveSource {
  captureChanges(): {
    regions: RegionDataV1[];
    token: WorldCaptureToken;
    totalRegionCount: number;
  };
  hasUnsavedChanges(): boolean;
  acknowledgeChanges(token: WorldCaptureToken): void;
}
