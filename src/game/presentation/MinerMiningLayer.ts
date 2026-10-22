import { AnimationClip, AnimationMixer, MathUtils, type AnimationAction } from 'three';

const UPPER_BONES = new Set(['UpperTorso','Head','LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand']);
const upperTrack = (name: string) => UPPER_BONES.has(name.split('.')[0]);

/** 上身挥镐只响应已生效的挖矿命中；下肢仍由移动动作控制。 */
export class MinerMiningLayer {
  readonly lower: AnimationAction[];
  private readonly upper: AnimationAction[];
  private readonly swing: AnimationAction;
  private age = Infinity;
  private period = .5;
  private startWeight = 0;
  weight = 0;
  strikes = 0;

  constructor(mixer: AnimationMixer, locomotion: AnimationClip[], mining: AnimationClip) {
    this.lower=locomotion.map(c=>mixer.clipAction(new AnimationClip(c.name,c.duration,c.tracks.filter(t=>!upperTrack(t.name)))).play());
    this.upper=locomotion.map(c=>mixer.clipAction(new AnimationClip(c.name+':upper',c.duration,c.tracks.filter(t=>upperTrack(t.name)))).play());
    const tracks=mining.tracks.filter(t=>upperTrack(t.name));
    if(!tracks.length)throw Error('挖矿动作缺少上身轨道');
    this.swing=mixer.clipAction(new AnimationClip('Mine:upper',mining.duration,tracks)).play();
    this.swing.paused=true;
    this.swing.setEffectiveWeight(0);
  }

  strike(speed: number) {
    if(!Number.isFinite(speed)||speed<=0)throw Error('挖矿动作攻速无效');
    this.startWeight=this.weight;
    this.age=0;
    this.period=1/speed;
    this.strikes++;
  }

  cancel() { this.age=Infinity;this.weight=0;this.swing.setEffectiveWeight(0); }

  update(delta: number) {
    this.age+=delta;
    const entry=Math.min(.055,this.period*.2);
    this.weight=this.age<=this.period
      ? MathUtils.lerp(this.startWeight,1,Math.min(1,this.age/entry))
      : Math.max(0,1-(this.age-this.period)/.12);
    this.swing.time=Math.min(this.age/this.period,1-1e-6)*this.swing.getClip().duration;
    this.swing.setEffectiveWeight(this.weight);
    for(let i=0;i<this.lower.length;i++){
      const lower=this.lower[i],upper=this.upper[i];
      upper.time=lower.time;
      upper.paused=lower.paused;
      upper.setEffectiveTimeScale(lower.getEffectiveTimeScale());
      upper.setEffectiveWeight(lower.getEffectiveWeight()*(1-this.weight));
    }
  }

  diagnostics() { return {active:this.weight>0,weight:this.weight,strikes:this.strikes,phase:Math.min(1,this.age/this.period),speed:1/this.period}; }
}
