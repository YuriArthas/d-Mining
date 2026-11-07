# 街景 Failed to fetch：定位与传输修复

2026-10-20，用户在 Windows Chrome 152 每次刷新均失败。公开入口为 `/games/mining-light/index.html`。

## 定位证据

原错误页只显示 `Failed to fetch`。新增资源 URL、加载阶段、浏览器版本和复制错误信息后，用户确认失败请求为 `assets/street.glb?v=aefc0a496509d383cc1acf5e0062c222abecccae4ba9f0762081cbc8663bcd73`，发生在模型加载阶段。

- 原 GLB 为 10,724,856 字节。本机不限速时通常成功，但一次发布校验实际出现 `HTTP/2 INTERNAL_ERROR`。
- 对同一个公开资源限制接收速度为 256 KiB/s：HTTP/2 在 4,423,680 字节处以 INTERNAL_ERROR 结束；HTTP/1.1 在 5,406,720 字节处断开，报剩余 5,318,136 字节未读。
- 相同限速下直接读取源站 `127.0.0.1:4173`，完整获得 10,724,856 字节且 SHA-256 一致。故障位于公开代理传输链路；并非依赖文件缺失、GLB 内容损坏或 shader 编译失败，也不是 HTTP/3 独有问题。
- 本机保存的 Clockbridge 网关源码有 64 帧接收队列（每帧约 32 KiB）及队列溢出后重置流的逻辑，与慢接收端断流现象相符。未取得线上网关对应请求的日志或部署版本，因此不将具体溢出分支标作已证实的线上根因。

## 本次修复

- 构建运行 `tools/prepare-transfer.mjs`，产生 `street.glb.gz` 作为标准 HTTP gzip 表示。当前压缩后 2,712,957 字节，减少约 74.7%。构建时解压并逐字节验证，来源与压缩产物哈希记录在 `artifacts/street-transfer.json`。
- 公共静态服务器 `../d-game1/server/serve.mjs` 对存在 `.gz` 表示的 GLB 协商 `Accept-Encoding`，返回正确的 `Content-Encoding`、压缩后的 `Content-Length` 和 `Vary: Accept-Encoding`。不接受 gzip 的请求仍得到 identity 表示；GET/HEAD 使用一致的表示头。原始 39 件资源均未改变，新增文件只有这个传输压缩副本。
- 浏览器原生 HTTP 解压，GLTFLoader、URL、原 GLB 哈希、几何精度、纹理、光照和渲染路径保持不变。没有应用层重试、替代模型或吞掉错误。
- 发布脚本用 `curl --compressed` 验证浏览器使用的 HTTP 表示，比较解压后的原资源哈希。只发布独立 `mining-light`，保护其余游戏发布文件。
- 加载错误保留具体资源与原始错误，覆盖 JSON 请求及其响应体读取、GLB、材质贴图、静态灯影；图形初始化和运行阶段单独显示。复制错误与手动重载均已验证。

这是当前街景的大响应传输修复，没有修改或声称修复通用网关的背压实现；其他更大的资源仍应独立检查。

## 验证

证据目录为 `artifacts/fetch-failure/`：

- `slow-transport.json`：修改前公开 HTTP/1.1、HTTP/2 失败与源站成功的同限速对照。
- `compressed-transport.json`：修改后公开 HTTP/1.1、HTTP/2 各以 256 KiB/s 和 64 KiB/s 下载，四次全部完成；解压后的完整模型 SHA-256 均相同。
- `verification.json`：正常公开加载，以及材质请求失败、HTTP 503、损坏的 JSON 响应体、GLB/布局/纹理/灯影网络失败共 8 个场景；错误资源和阶段准确，复制按钮工作，移除故障后手动重载成功。
- `visual-comparison.json`：错误提示改动前后正常街口画面逐像素一致。
- `transfer-browser.json`：传输修复后的公开浏览器正常加载、再次刷新和 256 KiB/s 限速加载。核对实际 `Content-Encoding`、编码/解码字节数、错误及截图。

浏览器使用项目既有 Playwright / Vulkan SwiftShader 流程，保留默认 QUIC；T3 预览受 AppArmor 限制。上述属于公开网络、功能与画面证据，不能当作用户笔记本 GPU 性能验收。
