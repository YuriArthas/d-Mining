# 彩色贴图 ETC1S 编码与 JS 体积审计

## 发布结果

公开测试入口：https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html 。正式 Mining 未覆盖。

- 首次请求正文合计：26,068,559 → 13,145,193 字节，约减少 49.6%。
- 77 个实际使用模型的压缩包总量：21,087,085 → 8,153,642 字节。两个小模型已内联在 JS 中，统计浏览器请求时不重复相加。
- 66 个生成资产的彩色贴图改为 KTX2 ETC1S，qlevel=200 / clevel=2。
- 512/256px 尺寸和 mip 数保持一致；法线、ORM、Blender 128px 原创图集保持原编码和数据。
- 几何、节点变换、模型三角面及场景实例数均不变。原 Tripo taskId、模型 sourceSha256 保留；这是纹理重编码，不是模型重新生成。
- 206 个活跃纹理源均使用 GPU 压缩格式；本次桌面转码后的 mip 载荷仍是 26,263,584 字节。减少下载不代表降低同等比例的显存。

## 工具与校验

`tools/lib/encodeColorTextures.mjs` 从已有的准备后 PNG 提取彩色通道，以原尺寸编码；`tools/lib/glbBuffers.mjs` 重排 GLB 二进制视图并检查几何哈希。所有非彩色图像必须逐字节相同。

`tools/repack-color-textures.mjs` 完成一次性迁移。`tools/pack-camp.mjs` 已接入相同编码流程，未来重新打包不会恢复成全 UASTC。

阴影烘焙依赖几何与布置。原先测试把运输文件哈希当作几何身份，纹理变化也会错误要求重烘焙。本次先确认旧包与烘焙 provenance 的运输哈希一致，再记录旧包的几何身份；新包必须匹配。原运输哈希作为历史记录保留，阴影图完全未改。未来导出烘焙数据也记录几何身份，测试核对实时二进制几何及节点变换。

18 项相关资源、几何、烘焙、解压与纹理上传测试通过。先在旧公开版本采集对照，再发布新版，检查同一出生视角的昼夜图像；未见明显退化，无页面异常，模型和 renderer 资源计数一致。未执行手机验收。

单次软件渲染样本：资源准备 4.13 → 2.73 秒，首个可玩状态 8.64 → 7.36 秒；样本不足以作为设备性能结论。

证据目录：`artifacts/texture-encoding/{before,after}`、`artifacts/texture-encoding/repack.json`、`artifacts/download-audit/current.json`。原压缩模型保留在 `artifacts/texture-encoding/original/` 供审计。没有修改 HTTP 压缩或缓存策略。

## JS 实际组成

修改贴图前主包为 4,353,621 字节。用隔离构建的 sourcemap 对压缩产物做归属统计；minifier 对内联 JSON 的映射可能落在相邻源文件，因此以下只作大类近似归属，不能将映射到某 TS 文件的所有字节称为该类的代码。

| 组成 | 近似大小 |
| --- | ---: |
| Rapier compat | 2.24 MB |
| Three.js 及插件 | 0.81 MB |
| React DOM / React Three Fiber | 0.37 MB |
| 项目逻辑、内联场景数据、其他依赖及未映射部分 | 0.94 MB |

Rapier 包中有 2,092,784 字符的 base64 WASM（解码后 1,569,588 字节）；另有 349,528 字符的烘焙阴影 base64（解码后 262,144 字节）。因此主 JS 的大部分不是项目业务逻辑。体积证据在 `artifacts/js-audit/breakdown.json`。新版额外增加约 10KB 的资源编码/几何哈希清单。

## 代码结构发现（本轮未整体重构）

- `ValidationScene.tsx` 的单个组件约 300 行，汇集启动、资源释放、渲染驱动、物理 tick、角色、相机、灯光、选格及调试 API，是最优先应拆分的模块。文件约 30KB，有超过 2,000 字符的单行，行数会低估维护复杂度。
- `StaticSurface.ts` 的主函数同时负责资产队列、材质修改、纹理上传、模型归一化、实例布置和地面 shader。应拆成加载、材质处理、场景组装三个职责，保留清晰入口。
- `GameSession` 是应用协调者；背包、钱包、挖矿、战斗与升级规则已有独立模块。它目前还聚合 UI 提示文案和读模型，这部分可继续下移到表现适配层。不能只按字段数量判定它与前两者同等问题。
- `Inventory.add` 不做满包准入限制，`Mining.request` 检查容量，`Mining.collected` 直接接收已采集结果；用户确认的领域边界仍在。
- 源码多语句同一行、嵌套逻辑压成一行的写法应统一整理。源码压缩不应替代构建工具的压缩。

建议先拆生产流程中的 `ValidationScene`，再拆 `StaticSurface`。拆分改善维护和测试；包体优化应分别处理内嵌 WASM、内联数据以及静态传输压缩。
