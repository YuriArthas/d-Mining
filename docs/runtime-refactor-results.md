# RF0—RF7 实施与验收

目标是逐步建立职责和资源所有权，再把关卡内容整理为可独立修改的数据。没有替换引擎、渲染调度或体素存储机制。

## 实施结果

| Phase | 结果 |
| --- | --- |
| RF0 | 记录启动/帧顺序、取消/清理路径、所有权及公开日夜基线，见 runtime-refactor-baseline.md |
| RF1 | EnvironmentController 独立；预热和运行共用环境应用，环境/天空参数可配置 |
| RF2 | SceneryView 与 SceneryCollision 分离，原 RoomFacilities 删除；普通视觉常驻、附近碰撞独立 |
| RF3 | ModelAssetLoader、assembleSurface、SceneAssetBundle 分工；保留加载上限，统一共享资源释放；显式表层效果句柄 |
| RF4 | PlayerController、CameraView、MiningInteraction 分工，复用原物理/相机/挖矿算法；维持一次性输入与采集结算语义 |
| RF5 | startGame 管装配，DisposalScope 管逆序释放/失败/迟到结果，updateGame 保持显式帧顺序；独立 debugGame，React 保留唯一 RAF 和绘制接入 |
| RF6 | GameSession 注入 SessionContent；设施锚点、传送展位、资源策略、材质参数、道路、草、层规格及环境数据明确分离；主线程/Worker 共用层配置 |
| RF7 | 自动化契约测试、公开玩法回归、真实配置实验及日夜画面对照；临时配置已恢复 |

当前内容修改入口详见 `level-content-guide.md`。没有建立关卡编辑器或热更新系统，也没有为拆分引入统一基类/通用事件总线。

## 验证证据

- 全量自动化：264 项通过（`artifacts/runtime-refactor/accepted-tests.log`）。覆盖原有经济、挖矿、物理、相机、稀疏地形、资源、合批与本轮新边界。
- 公开玩法：日夜切换、地心传送、解锁、回表层、真实土块销毁/入包/售卖通过；售卖后得到 1 金币，没有直接注入背包数据（`final-runtime/report.json`）。
- 公开加载：单调总进度到 100、首帧交接、HTTP 503 失败与重试、加载中退出、主脚本失败提示均通过（`loading-full.json`）。
- 同机位公开画面：出生点白天/黑夜与基线无明显造型、布局、材质回归（`before`、`final` 截图）。
- 取消/资源测试：逆序释放、错误释放不阻断其他资源、迟到资源立即清理、替换材质后资源仍归资产包、共享纹理只释放一次、借用纹理由拥有者释放。

上述路径相对于 `artifacts/runtime-refactor/`，完整加载页脚本另有 `artifacts/loading-page/report.json`。截图与功能浏览器使用桌面 Chromium SwiftShader，只提供功能和画面对照，不构成真实硬件帧率或手机性能结论。

## 公开配置实验

只改以下四个数据文件并发布到 Mining 测试入口，再打开浏览器验证：

1. surfaceFacilities.ts：售卖房屋 x 从 -12 改为 -15、朝向从 π 改为 π/2，外观由 simulator-exchange 换成 simulator-upgrade；门前触发区同步到 (-8.3,56)，物理落地后仍触发售卖，未进入升级商店。
2. layers.ts：第一地下层从 400m 调到 440m，主题换成 frozen_cave；空洞、房间视觉、落点、解锁与照明深度同步。
3. SceneLighting.ts：夜间主光强度从 2.25 改到 2.45，实际 DirectionalLight 读数一致。
4. grass.ts：草数量从 780 改到 600，实例统计一致。

`config-experiment/report.json`、`moved-facility.png`、`changed-layer.png` 保存运行与视觉证据。四个文件均已逐字恢复为试验前版本并重新发布。临时移动烘焙对象没有篡改旧烘焙数据；正式改变布局时仍需重新烘焙。

房间尺寸变更、主线程/序列化 Worker 结果一致、新层必须指定合法展位等由 `content-boundaries.test.mjs` 验证；不将这些静态测试描述为所有自定义地图的视觉验收。

## 资源与发布边界

公开默认地图对照：

| 指标 | 重构前 | 重构后 |
| --- | ---: | ---: |
| 场景模型实例 | 1113 | 1113 |
| 模型包总字节 | 8,153,642 | 8,153,642 |
| 压缩贴图来源 | 206 | 206 |
| 桌面转码后的贴图 mip 数据字节 | 26,263,584 | 26,263,584 |
| 该机位 renderer geometry / texture 数 | 131 / 222 | 131 / 222 |

这些是资源和对象计数，不是浏览器总内存测量。下载 4 路、8 个任务/租约、4 MiB 预留解压缓冲、1 个模型解析器和 2 个 KTX worker 的上限保持不变。

所有可试玩版本先发布后检查。发布脚本校验公网文件哈希、游戏列表含 Mining 测试版、正式 Mining 未被修改。测试入口：
https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html
