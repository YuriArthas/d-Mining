import {Component,type ReactNode} from 'react';
import {LOADING_STAGES,type LoadingState} from './loadingState.ts';
import loadingEmblem from './loading-emblem.svg?inline';
import { tr } from '../i18n/i18n.ts';
const labels={assets:tr("msg.mine_assets"),terrain:tr("msg.nearby_ground"),rooms:tr("msg.scenery"),shaders:tr("msg.graphics")};
const descriptions={assets:tr("msg.loading_the_mine"),terrain:tr("msg.laying_the_ground_under_your_feet"),rooms:tr("msg.setting_up_the_underground_camp"),shaders:tr("msg.lighting_up_the_mine")};
export function LoadingScreen({state,onExit}:{state:LoadingState;onExit:()=>void}){
 const active=LOADING_STAGES.find(s=>!state.steps[s].complete);
 const percent=Math.floor(state.progress*100);
 return <section className="loading-screen" aria-label={tr("msg.loading_mining")} data-phase={state.error?'error':state.ready?'ready':active??'entering'}>
  <div className="loading-topline"><span>MINING <b>·</b> {tr("msg.mine")}</span><button type="button" onClick={onExit}>{tr("msg.exit_game")} <span aria-hidden="true">↗</span></button></div>
  <div className="loading-content">
   <img className="loading-emblem" src={loadingEmblem} alt=""/>
   <div className="loading-eyebrow">{tr("msg.dig_down_haul_it_home")}</div>
   <h1>MINING</h1>
   <div className="loading-status" role="status" aria-live="polite">
    <h2>{state.error?tr("msg.could_not_enter_the_mine"):state.ready?tr("msg.ready_let_s_go"):active?descriptions[active]:tr("msg.the_mine_is_ready_here_we_go")}</h2>
    {state.error&&<p className="loading-error">{tr("msg.something_went_wrong_while_loading_please_try_again")}</p>}
   </div>
   {!state.error?<>
    <div className="loading-track" role="progressbar" aria-label={tr("msg.overall_loading_progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
     <span style={{width:`${state.progress*100}%`}}/>
    </div>
    <div className="loading-detail"><span>{state.ready?tr("msg.ready"):active?labels[active]:tr("msg.waiting_for_the_first_frame")}</span><span>{percent}%</span></div>
    <ol className="loading-steps">{LOADING_STAGES.map((stage,i)=><li key={stage} data-complete={state.steps[stage].complete} data-active={stage===active}><span>{state.steps[stage].complete?'✓':String(i+1).padStart(2,'0')}</span>{labels[stage]}</li>)}</ol>
   </>:<button className="loading-retry" onClick={()=>location.reload()}>{tr("msg.reload")}</button>}
  </div>
  <div className="loading-bottom"><span className="loading-tip">{tr("msg.tip_when_your_bag_is_full_tap_sell_to_teleport_and_sell_your")}</span><span>{tr("msg.explore_gather_grow")}</span></div>
 </section>;
}
export class LoadingBoundary extends Component<{onFailure:(message:string)=>void;children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error){this.props.onFailure(error.message);}
 render(){return this.state.failed?null:this.props.children;}
}
