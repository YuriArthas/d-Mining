import {Component,type ReactNode} from 'react';
import {LOADING_STAGES,type LoadingState} from './loadingState.ts';
import loadingEmblem from './loading-emblem.svg?inline';
const labels={assets:'矿场资源',terrain:'附近地形',rooms:'场景布置',shaders:'画面准备'};
const descriptions={assets:'正在装载矿场',terrain:'正在铺设脚下的土地',rooms:'正在布置地下营地',shaders:'正在点亮矿场'};
export function LoadingScreen({state,onExit}:{state:LoadingState;onExit:()=>void}){
 const active=LOADING_STAGES.find(s=>!state.steps[s].complete);
 const percent=Math.floor(state.progress*100);
 return <section className="loading-screen" aria-label="正在加载 Mining" data-phase={state.error?'error':state.ready?'ready':active??'entering'}>
  <div className="loading-topline"><span>MINING <b>·</b> 矿场</span><button type="button" onClick={onExit}>退出游戏 <span aria-hidden="true">↗</span></button></div>
  <div className="loading-content">
   <img className="loading-emblem" src={loadingEmblem} alt=""/>
   <div className="loading-eyebrow">向下探索 · 满载而归</div>
   <h1>MINING</h1>
   <div className="loading-status" role="status" aria-live="polite">
    <h2>{state.error?'暂时没能进入矿场':state.ready?'准备就绪，出发！':active?descriptions[active]:'矿场就绪，即将出发'}</h2>
    {state.error&&<p className="loading-error">加载遇到了一点问题，请重新尝试。</p>}
   </div>
   {!state.error?<>
    <div className="loading-track" role="progressbar" aria-label="总加载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
     <span style={{width:`${state.progress*100}%`}}/>
    </div>
    <div className="loading-detail"><span>{state.ready?'准备就绪':active?labels[active]:'等待首帧画面'}</span><span>{percent}%</span></div>
    <ol className="loading-steps">{LOADING_STAGES.map((stage,i)=><li key={stage} data-complete={state.steps[stage].complete} data-active={stage===active}><span>{state.steps[stage].complete?'✓':String(i+1).padStart(2,'0')}</span>{labels[stage]}</li>)}</ol>
   </>:<button className="loading-retry" onClick={()=>location.reload()}>重新加载</button>}
  </div>
  <div className="loading-bottom"><span className="loading-tip">挖满背包后，前往收购处换取金币。</span><span>探索 · 采集 · 成长</span></div>
 </section>;
}
export class LoadingBoundary extends Component<{onFailure:(message:string)=>void;children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error){this.props.onFailure(error.message);}
 render(){return this.state.failed?null:this.props.children;}
}
