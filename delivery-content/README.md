# 掘矿大师 / Mining Master

独立 Web 挖矿游戏，横屏优先，支持键鼠和手机触控。

## 运行

使用 Node.js 24（见 .nvmrc）：

```sh
npm ci --ignore-scripts
npm run verify:source
npm run build
npm run serve
```

打开 http://127.0.0.1:4175/。开发模式使用 `npm run dev`。不要通过 file:// 打开。

也可直接把附带的 `dist/` 完整上传到静态 HTTPS 站点；支持根目录或子目录，无需后台服务和 API。本次导入版本要求普通存档会话必须支持 Web Locks，可在支持该 API 的 HTTPS 或可信 localhost 上运行。普通局域网 HTTP 缺少该 API 时启动失败；这是相对上一版的已知兼容回退。资源使用相对路径，字体、模型、物理引擎及贴图均本地打包。构建安装需访问 npm，运行无需第三方 CDN。

## 操作与存档

手机横屏：左摇杆移动，拖动画面转镜头，右下跳跃，点选矿块挖掘；靠近设施后使用查看按钮。键盘 WASD 移动，空格跳跃，E 交互。菜单中有操作帮助、语言、声音和画面选项。

进度与语言仅保存在当前浏览器当前站点的标准 localStorage。进度和稀疏矿坑以单个完整快照一起写入；换站点不会自动迁移，清除站点数据会删除进度。旧存储方案的进度不读取、不自动迁移，也不删除。配额不足或存储被禁用时显示保存失败并保留上次成功快照，不切换其他存档路径。详见 `docs/SAVES.md`。

## 调试

按 d-survivor 相同规则保留测试和调试源码：普通入口不执行测试脚本，不启动帧率计量、渲染剖析、碰撞调试视图、性能观察器或上报。只有精确的 `?debug=1` 启用本地统计和调试工具；`debug=0`、`debug=true` 以及单独的诊断调参均不会开启。诊断上传按钮和网络上传代码已删除。

`?debug=1` 默认使用独立内存存档，不读取或改写玩家存档，刷新后清空。持久化验收请显式使用 `?debug=1&saveTest=your-id`，只操作独立的 localStorage 验收键。UI 示例页使用 `?debug=1&kit=1`。诊断代码可能保留在产物中，分离边界是正常运行不启用诊断与调试存档隔离。

## 包内容与来源

`src/`：源码和运行素材；`tools/tests/`：离线测试及最少必要素材夹具；`dist/`：已构建可部署版本；`licenses/` 与 `THIRD_PARTY_NOTICES.md`：第三方许可；`ASSET_PROVENANCE.md` 与 `public/provenance/`：素材来源、哈希和许可资料范围；`DELIVERY.json`：固定构建时间与交付配置。

这是当前工作区的独立交付快照，另含当前场景/角色/商店/宠物的精选 Blender 工作文件和制作脚本。不含 Git 历史、历史截图、依赖目录、内部部署工具及接收日志的服务。开发配置、日志接收器和旧遥测脚本的两组测试随对应功能一起排除，具体文件见 DELIVERY.json。其他游戏的源码不包含在交付中。

构建时间固定在 DELIVERY.json 中，重复构建应生成相同的 dist 文件内容。

## 源码与数值接续

入口、模块、干净构建及部署步骤见 `docs/SOURCE_GUIDE.md`；数值的当前值、单位、约束和实际消费者见 `docs/PARAMETERS.md`、`docs/parameter-catalog.json`。渲染固定 60 帧上限。素材来源与本次许可资料范围见 `ASSET_PROVENANCE.md`；Tripo3D、Mixamo 授权证明按用户要求不附。本包不把构建/模拟验证等同于基准真机验收。

新增语言仅添加 `src/game/i18n/locales/*.json`；完整格式和交付源码一致性说明见 `docs/I18N_DELIVERY.md`。本轮验证范围见 `docs/VALIDATION.md`。
