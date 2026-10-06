export {};
declare global {
 interface Window {
  __MINING_LOG_CONFIG__?: {endpoint?:string;enabled?:boolean};
  __MINING_LOG__?: {
   sessionId:string;
   write(type:string,data?:unknown):void;
   flush(beacon?:boolean):void;
   phase(name:string,data?:unknown):void;
   fail(error:unknown,type?:string):void;
   ready():void;
   diagnostics():{sessionId:string;enabled:boolean;phase:string;queued:number;failures:number;dropped:number};
  };
 }
}
