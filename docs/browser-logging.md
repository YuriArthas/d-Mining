# Mining 客户端诊断日志

公开收集端：`https://mining-log-sunjun-public.dev.clock-p.com/ingest`。
健康检查：同域 `/healthz`。只开放写入和汇总健康状态，不公开读取日志。

游戏仍然是纯静态客户端。日志接收器是独立、可关闭的诊断服务，不参与存档、地形生成或游戏加载成功判断。
默认只有 `/games/mining-test/` 启用；正式入口和其他路径默认关闭。

## 注入

在 HTML 的启动诊断脚本之前写入配置，或通过浏览器自动化的 `addInitScript` 注入：

```js
window.__MINING_LOG_CONFIG__ = {
  endpoint: 'https://mining-log-sunjun-public.dev.clock-p.com/ingest',
  enabled: true,
};
// 完全停止发送：window.__MINING_LOG_CONFIG__ = {enabled: false};
```

业务模块无需依赖服务器包，可选地调用：

```js
window.__MINING_LOG__?.write('terrain.debug', {pendingChunks: 2});
window.__MINING_LOG__?.diagnostics();
```

内联脚本先于主模块启动，记录入口、脚本/CSS 下载耗时、模块加载异常、全局错误、未处理 Promise、console warn/error、加载阶段、游戏就绪和心跳。
HTML 和 React 共用加载页的图案和样式。启动失败只显示面向玩家的重试提示；诊断编号、技术阶段和错误详情只保留在后台日志及调试 API 中。
主模块使用独立的小 bootstrap 动态加载，下载/执行失败可以被捕获。

每次打开/刷新独立产生随机 sessionId；每个事件携带递增 seq、客户端时间、收到时间、耗时、构建时间、路径和浏览器版本。
自动记录的页面路径不带 query/hash，不读取 cookie、存档或凭证；业务自定义日志由调用者控制内容。

队列最多 120 条，每批最多 12 条且限制 UTF-8 字节数；每 2 秒尝试发送。超时 5 秒，失败指数退避至 30 秒。关闭页面尝试 beacon。
这是尽力发送：崩溃、长时间离线、浏览器冻结或队列溢出时可能丢失。重试/beacon 可能重复；用 sessionId + seq 去重。

## 服务端和部署

`server/logs/receiver.mjs` 只使用 Node 内置模块（项目 Node 24）。监听 `127.0.0.1:4186`，通过独立 Clockbridge 公开。
按日期/会话写 JSONL；同一会话串行 append，不同会话可并发写。HTTP 202 表示已完成文件 append（不承诺磁盘 fsync）。
限制：64 KiB 请求、40 条事件、8 MiB 待写队列、256 个连接、每天 256 MiB；保留最近约 7 天并定期清理。
允许游戏站点 Origin；无 Origin 的脚本调用也可写入。公共写入端无用户身份认证，日志仅作诊断数据，不作可信业务依据。

```sh
install -m 644 deploy/mining-log*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mining-log.service mining-log-clockbridge.service
curl https://mining-log-sunjun-public.dev.clock-p.com/healthz
```

服务配置保存在 `deploy/`。Clockbridge 使用宿主现有凭证，凭证不进入项目。日志目录 `/var/lib/mining-log`，服务自动重启/开机启动，内存上限 192 MiB。

## 查看与验证

```sh
node tools/logs/read.mjs                 # 最近两天，最多 30 个会话摘要
node tools/logs/read.mjs <sessionId>     # 同一范围内该会话的事件，按 seq 排序并去重
node --test tools/tests/log-receiver.test.mjs tools/tests/boot-telemetry.test.mjs
# 先发布测试版，再从公开入口验证；可设置 PLAYWRIGHT_MODULE 指向本机 Playwright。
node tools/logs/check-public.cjs
```

单测涵盖并发多会话/同会话、坏请求、配额、写盘失败恢复、注入/关闭、失败退避和 UTF-8 批量限制。
公开检查覆盖正常启动、同时打开的独立失败会话、主模块下载失败上报、重新加载恢复及禁用日志后正常进入游戏。
结果写到 `artifacts/mining-log/public-report.json`。

最初用户卡在 HTML 首屏的问题尚未复现；本次增加的是能从用户实际运行捕获现场的诊断能力，不能据此宣称原故障已修复。

## 本轮验证结果（2026-10-06 UTC）

- 构建通过，全套 282 项测试通过；接收器最终 URL 校验调整后，8 项日志专项测试再次通过。
- 公开域名 8 个会话同时发送 32 批，全部返回 202，落盘 32 条，无会话混写。
- 公开桌面浏览器正常启动、主脚本故障上报、点击重试恢复、关闭日志正常启动全部通过。关闭时发往日志域名的请求为 0。
- 测试版发布脚本逐文件校验公开资源哈希，并确认正式 Mining 文件未变。
