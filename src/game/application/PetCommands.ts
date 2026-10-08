import type { PetService } from "./PetService.ts";
// Application commands complete settlement before publishing a durable change.
export class PetCommands {
  constructor(
    privateService: PetService,
    completed: () => void,
    allowed: () => boolean = () => true,
  ) {
    this.service = privateService;
    this.completed = completed;
    this.allowed = allowed;
  }
  private readonly service: PetService;
  private readonly completed: () => void;
  private readonly allowed: () => boolean;
  private check() {
    if (!this.allowed()) throw Error("当前会话不可操作");
  }
  hatch = (id: string) => {
    this.check();
    const r = this.service.hatch(id);
    if (r.status === "hatched") this.completed();
    return r;
  };
  equip = (id: string) => {
    this.check();
    const r = this.service.equip(id);
    if (r.status === "equipped") this.completed();
    return r;
  };
  unequip = (id: string) => {
    this.check();
    return this.changed(this.service.unequip(id));
  };
  equipBest = () => {
    this.check();
    return this.changed(this.service.equipBest());
  };
  unequipAll = () => {
    this.check();
    return this.changed(this.service.unequipAll());
  };
  private changed(changed: boolean) {
    if (changed) this.completed();
    return changed;
  }
}
