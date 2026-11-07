# 旧街景完整发布包 ≤5 MB（历史记录）

> 2026-10-20 后续更正：用户明确“5 MB 不是硬限制”。当前田字街区保留完整资源账目，构建与发布已取消 5 MB 拒绝门槛。本文记录旧版 4.47 MB 街景，当前版本见 [district.md](district.md)。

公开入口：<https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html>。
构建：`street-DjIGe_iT.js`。限制使用十进制：5 MB = 5,000,000 字节。

## 完整账目

当前 `light-study/dist` 与线上 `games/mining-light` 文件清单、长度及哈希完全一致，共 31 个文件、**4,467,253 字节**，剩余 532,747 字节。文件系统实际分配空间为 4,546,560 字节，也低于 5 MB。这个数包含全部运行资源和发布说明，没有把必需资源放到 CDN 或其他目录来绕过统计。

| 内容 | 字节 |
| --- | ---: |
| 街景模型、移动灯实验模型及布局 | 1,370,793 |
| 4096² 静态阴影图 | 1,415,902 |
| 21 张材质贴图及材质清单 | 708,132 |
| Three.js 与场景脚本、CSS、HTML、部署说明 | 972,426 |
| 合计 | **4,467,253** |

前一完整构建为 21,172,201 字节，前一线上目录为 22,158,979 字节。现在发布目录只有当前版本。小院对照、备用材质和旧构建退出这个街景包；小院的制作代码及原始素材仍保存在工作区，当前页面的返回链接指向游戏列表。

## 无损资源处理

- GLB 只存一份 1,331,284 字节的 Brotli 表示，不再同时部署 10,724,856 字节原文件和 2,712,957 字节 gzip。解码后的 GLB SHA-256 仍为 `aefc0a496509d383cc1acf5e0062c222abecccae4ba9f0762081cbc8663bcd73`，117156 个三角面、1058 个来源网格、19 个批次完全保留。
- 阴影图 PNG 1,838,228 → 无损 WebP 1,415,902 字节；21 张使用中的材质图 PNG 931,549 → 无损 WebP 698,880 字节。所有图片均核对尺寸和解码后完整 RGBA 字节一致，没有降低尺寸或颜色精度。
- 原始 Blender 模型、PNG、历史烘焙输入和哈希保持原样。打包器生成独立材质清单，只声明可用的 crafted 配置，不允许请求未打包的 baseline 配置。

这优化的是磁盘与传输体积；解码后的几何和贴图内存、每帧着色量没有因此下降。3 / 5 ms 的实机 GPU 目标仍需相应设备数据验证。

## 构建、服务与发布

`npm run build` 运行类型检查、GLB 无损编码、`tools/pack-street.py`、Vite、来源校验、`tools/release-budget.mjs`。Vite 只复制 `.packed` 中明确选出的资源。构建和发布各自检查全部文件字节数，超过 5,000,000 就失败；发布输入禁止符号链接。已实测刚好 5 MB 可通过、超出 1 字节拒绝、外部符号链接拒绝。

`d-game1/server/static-file.mjs` 允许逻辑 `/assets/street.glb` 从唯一 `.glb.br` 文件提供标准 `Content-Encoding: br` 响应，保留正确的 MIME 和 `Vary: Accept-Encoding`。拒绝 Brotli 但接受 identity 的客户端由服务端流式解压，无需磁盘原文件；明确拒绝所有可用表示则返回 406。HEAD 不读取或解压模型体。部署到其他静态服务器时也必须配置这个表示映射，具体要求在发布包 `DEPLOY.txt`。

发布器先将旧目录压缩归档、逐项校验可恢复性，再发布和校验新资源，移除未列入当前包的文件，最后重新核对完整线上目录以及实际 GLB URL。旧目录归档为 11,170,391 字节，保存在 `artifacts/compact-release/archives/`；它不参与网页运行，但仍占服务器备份空间。因此本轮达成的是完整部署资源包的 5 MB 限制，不是清空所有开发资料或备份后的整台机器占用。

## 公开验证

- 公开所有发布文件均核对哈希，其他游戏文件受到发布器保护；HTTP/1.1、HTTP/2 的 Brotli 响应、identity/gzip-only 客户端的解码结果、HEAD、406 均通过。
- 新建 Chromium 上下文加载公开页，21 张材质图加 1 张阴影图都是 WebP；没有 PNG、小院模型、外部 CDN 请求或缺失资源。默认关闭移动灯，持续提交静态帧，夜景每帧 8 个通道。
- 960×640 夜景与前一公开版本逐像素一致；日夜切换与灯下/街口视角检查正常。公开截图见 `artifacts/compact-release/public/`。
- 首次加载响应体共 4,466,637 字节（部署说明不需要下载）。实际点击“静态测帧率并上报”完成 30 秒，报告 `d0ade1a0-fa16-469b-a121-9599f789df5d` 保存 9 帧、提交速率 0.282 FPS；SwiftShader 太慢，该段没有普通每 15 帧一次的 GPU 样本，不能据此评价真实硬件。强制采样另外确认了静态夜景的 8 个通道。
- 19 项帧调度/历史/计时等测试、9 项报告服务测试、2 项资源协商/HTTP 流测试通过。
- T3 内置浏览器返回 `Preview automation open failed: This host blocks the sandbox T3's browser runs in (AppArmor on Ubuntu 23.10+)`，因此使用已有 Playwright 工作流验证已发布公开页。环境为 Chromium / SwiftShader，仅能证明功能和图像，不能代替 iPhone / 笔记本硬件帧率。

完整大小清单在 `artifacts/release-size.json`，压缩像素与来源记录在 `artifacts/street-packed.json`，公开传输与图像证据在 `artifacts/compact-release/`。
