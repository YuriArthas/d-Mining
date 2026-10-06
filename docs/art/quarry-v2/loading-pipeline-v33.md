# V33：有上限的并发下载与流式解压

发布位置：<https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html>。
正式 Mining 未改动；游戏仍完全在客户端执行，服务器仅提供静态资源。

## 实现与边界

- `AssetPrefetch` 同时运行最多 4 个模型下载/解压任务，完成顺序消费；慢资源不会阻塞已经就绪的资源。
- 原有 gzip 流式解压保留，解压结果直接写入预先分配的 GLB 缓冲，不再用 `Response.arrayBuffer()` 汇集完整结果。
- 所有模型清单新增实际 gunzip 长度 `decodedBytes`；打包工具同时写入此字段。压缩长度、解压长度都严格检查，文件内容及资源哈希未改。
- 开始请求之前预留完整解压缓冲额度。正在下载、排队、正在解析/上传的模型合计最多 8 个、4 MiB；消费结束才释放额度。
- 解析保持每次一个模型；KTX2 转码 Worker 上限从 1 改为 2。浏览器原生 DecompressionStream 可同时处理多个流，不承诺浏览器将每个流映射到独立 CPU 核心。
- 保留 V32 GPU 上传批处理；场景最终仍常驻，普通场景没有距离卸载。
- 失败/退出会取消其他请求、清理待消费缓冲并等待后台任务结束。模型解码失败不会被忽略。
- 4 MiB 仅为本流水线预留的 GLB 缓冲上限，不是浏览器进程、GPU、最终场景或原生解码器工作内存上限。
- `downloadMs` 是单个资源任务耗时。任务存在重叠，其总和不代表下载墙钟耗时；诊断输出改称 `downloadTaskMsSum`。

## 公开入口对照

先测已公开的 V32，再发布 V33，然后使用同一公开入口测新版。各 3 次独立 Chromium，960×540，SwiftShader；CDP 设置 latency=60ms、下载 2.5 MiB/s、上传 1 MiB/s。均开启相同诊断。以下是游戏启动计时，非用户设备实测或整个导航总耗时。

| 指标 | V32 三轮中位数 | V33 三轮中位数 |
| --- | ---: | ---: |
| 场景资源准备 | 15,631.7 ms | 9,204.8 ms |
| 启动至可玩 | 20,300.7 ms | 13,803.2 ms |
| 最长主线程任务 | 355 ms | 364 ms |
| GPU 纹理上传等待 | 655.4 ms | 688.3 ms |

资源准备缩短约 41%，启动至可玩缩短约 32%。新版三次可玩时间分别为 13.781 / 17.374 / 13.803 秒；第二次其他阶段也变慢，不能把此环境结果当作真机时间承诺。

另做一次不附加网络限速的新版检查：资源准备 3.017 秒、可玩 7.498 秒。此前 V32 三轮中位数分别为 3.052 / 7.680 秒。这里没有严格配对的重复样本，不据此宣称低延迟环境下有显著提升；本次收益主要来自消除网络串行等待。

三轮限速样本缓冲预留峰值最大 2,572,780 字节；无附加限速样本峰值 3,209,284 字节（约 3.06 MiB）。所有样本下载并发最大 4，队列加消费中的模型最大 8，均低于字节上限。

## 资源与回归

对资源记录排序后比较，避免把下载完成顺序变化误当作资源变化：

- 实际加载 77 个模型，运输内容 21,087,085 字节。
- 活跃纹理 206 张，纹理 mip 编码载荷 26,263,584 字节；这是载荷大小，不是总内存。
- 模型三角面、实例数量、纹理规格与编码字节、renderer geometry/texture 计数均与 V32 相同。
- 构建、30 项相关单元/资源检查通过。
- 资源清单旧检查原先错误地要求资产库与放置清单完全相同：`bank-steps` 已保留在库但不再放置。本次将其列为明确的闲置资产，继续对其余清单做严格相等检查；没有新增实际加载模型。
- 公开版本启动、昼夜切换、地下传送、返回表层检查通过，10 个层场景保留；无页面或 shader 错误。本轮为加载机制调整，公开回归关闭截图，不执行手机验证。

## 尚未解决

本次未消除同步场景组装/地下几何准备的长任务，也未重写 shader。新版限速第二轮仍出现 619ms 主线程任务；无附加限速时场景准备末段仍有 321ms 任务。SwiftShader 环境缺少并行 shader 编译扩展，无限速样本 shader 预热仍为 3.38 秒。不能把本轮结果描述成“加载卡顿全部解决”。

## 复现与证据

- `artifacts/loading-pipeline/before-network{,-2,-3}/cold.json`：V32 三轮。
- `artifacts/loading-pipeline/after-network-{1,2,3}/cold.json`：V33 三轮。
- `artifacts/loading-pipeline/after-direct/cold.json`：新版无附加限速样本。
- `artifacts/loading-pipeline/summary.json`：汇总、资源相等断言和队列上限断言。
- `artifacts/loading-pipeline/runtime/`：公开功能回归。
- `artifacts/preview-release.json`：公开资源哈希核验与正式入口未改动记录。

```sh
OUT_DIR=artifacts/loading-pipeline/after-network-1 SINGLE=1 NETWORK_LATENCY_MS=60 node tools/diagnose-startup.cjs
node tools/summarize-loading-pipeline.cjs
SKIP_SHOTS=1 OUT_DIR=artifacts/loading-pipeline/runtime node tools/check-shader-prewarm.cjs
```
