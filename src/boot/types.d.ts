export {};
declare global { interface Window { __MINING_BOOT__?: { fail(error?:unknown):void; ready():void }; } }
