import type { InventoryDataV1 } from "../logic/Inventory.ts";
import type { PetStateDataV1 } from "../logic/pets/types.ts";
// Durable facts only. This contract neither imports the live session nor contains UI data.
export type ProgressDataV1 = {
  equipment?: import('../logic/EquipmentSave.ts').EquipmentSaveData | import('../logic/EquipmentCollection.ts').EquipmentData;
  worldProgress?: import('../logic/WorldProgress.ts').WorldProgressData;
  materials?: import('../logic/MaterialStore.ts').MaterialStoreData;
  worldExploration?: Record<string, ProgressDataV1['exploration']>;
  rewards?: import('../logic/Rewards.ts').RewardData;
  onboarding?: import('../logic/Onboarding.ts').OnboardingData;
  rebirth?: import('../logic/Rebirth.ts').RebirthData;
  version: 2;
  wallet: import('../logic/Wallet.ts').WalletData;
  inventory: InventoryDataV1;
  pickaxe: { version: 1; level: number };
  pets: PetStateDataV1;
  exploration: {
    version: 1;
    maxDepth: number;
    unlockedDestinationIds: string[];
  };
};
