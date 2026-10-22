import type { InventoryDataV1 } from "../logic/Inventory.ts";
import type { PetStateDataV1 } from "../logic/pets/types.ts";
// Durable facts only. This contract neither imports the live session nor contains UI data.
export type ProgressDataV1 = {
  equipment?: import('../logic/EquipmentCollection.ts').EquipmentData;
  worldProgress?: import('../logic/WorldProgress.ts').WorldProgressData;
  reservations?: import('../logic/MineralReservation.ts').ReservationData;
  worldExploration?: Record<string, ProgressDataV1['exploration']>;
  rewards?: import('../logic/Rewards.ts').RewardData;
  challengeBoard?: import('../logic/ChallengeBoard.ts').ChallengeBoardData;
  onboarding?: import('../logic/Onboarding.ts').OnboardingData;
  version: 1;
  wallet: { version: 1; coins: number };
  inventory: InventoryDataV1;
  pickaxe: { version: 1; level: number };
  pets: PetStateDataV1;
  exploration: {
    version: 1;
    maxDepth: number;
    unlockedDestinationIds: string[];
  };
};
