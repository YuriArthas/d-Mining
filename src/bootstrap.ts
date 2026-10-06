// Keep the diagnostic bootstrap independent of the large game dependency graph.
window.__MINING_LOG__?.phase('正在下载并启动游戏主程序');
import('./main.tsx').then(()=>{
  window.__MINING_LOG__?.write('game.module-evaluated');
}).catch(error=>window.__MINING_LOG__?.fail(error,'game.import-failed'));
