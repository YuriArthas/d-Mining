import {Component,type ReactNode} from 'react';
import {LOADING_STAGES,type LoadingState} from './loadingState.ts';
import './loading.css';
const labels={assets:'矿场资源',terrain:'附近地形',rooms:'场景布置',shaders:'画面准备'};
const descriptions={assets:'正在装载矿场',terrain:'正在铺设脚下的土地',rooms:'正在布置地下营地',shaders:'正在点亮矿场'};
export function LoadingScreen({state,onExit}:{state:LoadingState;onExit:()=>void}){
 const active=LOADING_STAGES.find(s=>!state.steps[s].complete);
 const percent=Math.floor(state.progress*100);
 return <section className="loading-screen" aria-label="正在加载 Mining" data-phase={state.error?'error':state.ready?'ready':active??'entering'}>
  <div className="loading-topline"><span>MINING <b>·</b> 矿场</span><button type="button" onClick={onExit}>退出游戏 <span aria-hidden="true">↗</span></button></div>
  <div className="loading-content">
   <svg className="loading-emblem" viewBox="0 0 320 230" aria-hidden="true">
    <ellipse cx="161" cy="205" rx="99" ry="12" fill="#08171f" opacity=".55"/>
    <path d="M51 131 157 85 270 128 165 179Z" fill="#669886"/><path d="m51 131 114 48v31L51 163Z" fill="#294e51"/><path d="m165 179 105-51v31l-105 51Z" fill="#193d45"/>
    <path d="m105 98 57-27 59 26-57 29Z" fill="#7e949b"/><path d="m105 98 59 28v55l-59-28Z" fill="#4c6772"/><path d="m164 126 57-29v57l-57 27Z" fill="#34515f"/>
    <path d="m116 123 16 7v17l-16-7zm23 26 15 6v15l-15-7z" fill="#edbd63"/><path d="m178 138 19-9v16l-19 9zm22-21 12-6v13l-12 6z" fill="#65dcc8"/>
    <path d="m151 105-6-38 17-25 18 28-5 34-14 8Z" fill="#65ddcd"/><path d="m162 42 1 69-12-6-6-38Z" fill="#b9f1d8"/><path d="m163 111 17-41-5 34Z" fill="#339d9e"/>
    <path d="m221 67 11-13 7 13-3 27-12 5Z" fill="#73bdc7"/><path d="m221 67 11-13-4 43-4 2Z" fill="#b5ebdd"/>
    <path d="m86 72 8-10 80 87-10 10Z" fill="#bd7b45"/><path d="m89 74 5-5 75 83-4 5Z" fill="#e4b277"/>
    <path d="m58 76 9-18 24-14 28-4 28 7 15 16-29-7-20 4-19 10-12 17Z" fill="#dce6df"/><path d="m58 76 24 11 12-17 19-10 20-4 29 7-13 4-16-5-20 5-15 9-13 20-24-10Z" fill="#819eaa"/>
    <g fill="#eecd80"><path d="m63 108 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/><path d="m245 91 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/></g>
   </svg>
   <div className="loading-eyebrow">向下探索 · 满载而归</div>
   <h1>MINING</h1>
   <div className="loading-status" role="status" aria-live="polite">
    <h2>{state.error?'暂时没能进入矿场':state.ready?'准备就绪，出发！':active?descriptions[active]:'矿场就绪，即将出发'}</h2>
    {state.error&&<p className="loading-error">{state.error}</p>}
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
