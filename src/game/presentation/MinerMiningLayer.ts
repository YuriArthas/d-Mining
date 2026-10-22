import { MathUtils } from 'three';
import { SWING_IMPACT } from './minerMotions.ts';

/** Shortest and longest visible swing. Faster attacks still deal damage on every accepted hit,
 *  but the arm finishes its current swing first: at most one swing waits, never a backlog. */
export const SWING_SECONDS = { min: 0.22, max: 0.6 } as const;
const FADE_OUT = 0.12;

/** Upper-body swing timing; it only responds to hits that actually dealt damage. */
export class MinerMiningLayer {
  private age = Infinity;
  private period = .5;
  private attackSpeed = 0;
  private waiting = false;
  private startWeight = 0;
  private contactDone = true;
  private contactPending = false;
  weight = 0;
  strikes = 0;
  swings = 0;
  contacts = 0;

  strike(speed: number) {
    if(!Number.isFinite(speed)||speed<=0)throw Error('挖矿动作攻速无效');
    this.attackSpeed=speed;
    this.strikes++;
    if(this.age<this.period)this.waiting=true;
    else this.begin(0);
  }

  cancel() { this.age=Infinity;this.weight=0;this.waiting=false;this.contactDone=true;this.contactPending=false; }

  /** True once per swing, on the frame the pick reaches the block. */
  consumeContact() { const contact=this.contactPending;this.contactPending=false;return contact; }

  /** Swing progress for the clip, 0 at the ready pose and 1 back at it. */
  get phase() { return Math.min(this.age/this.period,1-1e-6); }

  update(delta: number) {
    this.age+=delta;
    if(this.waiting&&this.age>=this.period)this.begin(Math.min(this.age-this.period,delta));
    if(!this.contactDone&&this.age>=SWING_IMPACT*this.period&&this.age<=this.period){this.contactDone=true;this.contactPending=true;this.contacts++;}
    const entry=Math.min(.05,this.period*.2);
    this.weight=this.age<=this.period
      ? MathUtils.lerp(this.startWeight,1,Math.min(1,this.age/entry))
      : Math.max(0,1-(this.age-this.period)/FADE_OUT);
  }

  private begin(age: number) {
    this.startWeight=this.weight;
    this.age=age;
    this.period=MathUtils.clamp(1/this.attackSpeed,SWING_SECONDS.min,SWING_SECONDS.max);
    this.waiting=false;
    this.contactDone=false;
    this.swings++;
  }

  diagnostics() {
    return {active:this.weight>0,weight:this.weight,strikes:this.strikes,swings:this.swings,contacts:this.contacts,phase:this.phase,speed:this.attackSpeed,swingSeconds:this.period};
  }
}
