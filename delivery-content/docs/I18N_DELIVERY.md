# 语言资源与交付源码

语言包位于 `src/game/i18n/locales/<语言 ID>.json`。新增语言时复制 `en.json`，修改 `id`、`label`、BCP 47 `locale`、排序 `order`、数字缩写 `numberUnits` 与完整 `messages`，运行 `npm run build`。不需要编辑游戏 TS/TSX 或增加 import。启动画面、菜单列表与游戏文本均来自同一资源目录，构建为本地资源，无运行时语言下载。开发服务在资源变化后刷新。

`tools/prepare-locales.mjs` 自动发现语言并校验元数据、完整键集、占位参数、Unicode NFC 和单位配置，生成 `generated/locales.json`。此文件由工具维护。消息 ID 稳定，不因改文案或译文改变；新增消息先在中文资源定义 ID，并补齐所有包。

内容层用 `message(id, params)` 保存 `TextRef`。矿物、宠物、蛋、世界、层、装备和奖励名称保持引用；通知同样保留引用，嵌套名称与数字保持原值。`PetUiAdapter`、会话显示快照与 UI/标牌渲染边界负责解析。显示数字采用语言包的 locale，存档、数值、交易、概率和 RNG 不参与翻译。切换语言仍在保存进度后重载，并保留 URL 语言选择。

`GuidePath.tsx` 是组件，`guidePathGeometry.ts` 是几何与位置更新。构建检查大小写折叠后的路径和模块名、Windows 保留名、显式扩展名及 import 大小写。此检查不等于已执行 Windows 构建。

开发与交付使用同一份运行源码和 Vite 配置。普通启动只提供加载 UI，固定最多 60 帧；诊断计量仅显式 `?debug=1` 开启，游戏无性能上传按钮或上传调用。`tools/export-delivery.mjs` 仅选择文件和交付元数据，不补丁修改源码、不修改锁定依赖版本。`delivery-content/` 存放已审阅的交付文档、许可证和制作资料；导出时展开到交付根目录。

导出时 `SOURCE_MANIFEST.json` 记录全部运行源码及共用构建工具的哈希。解压源码包后先执行 `npm run verify:source` 核对，再用 Node.js 24 执行 `npm ci --ignore-scripts`、`npm run build`。源码安装需要本机 npm 缓存或 npm registry；交付 dist 运行完全使用本地资源，不包含 Node.js/npm 包。新增语言不会要求修改游戏源码。

本轮仅执行 CPU 静态检查和针对性测试，不启动 GPU 或浏览器，不把历史浏览器/真机证据算作本轮验证。
