# Mining

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

也可直接把附带的 `dist/` 完整上传到任意静态 HTTP(S) 站点；支持根目录或子目录，无需后台服务和 API。资源使用相对路径，字体、模型、物理引擎及贴图均本地打包。构建安装需访问 npm，运行无需第三方 CDN。

## 操作与存档

手机横屏：左摇杆移动，拖动画面转镜头，右下跳跃，点选矿块挖掘；靠近设施后使用查看按钮。键盘 WASD 移动，空格跳跃，E 交互。菜单中有操作帮助、语言、声音和画面选项。

进度保存在当前浏览器当前站点的 IndexedDB，语言存在 localStorage。换站点不会自动迁移存档；清除站点数据会删除进度。

## 调试

仅显式 `?debug=1` 打开本地统计和测试工具；普通入口不启动帧率计量、渲染剖析、性能观察器或上报。诊断上传按钮和网络上传代码已删除。测试工具会改变隔离测试存档，交付验收时请使用 `?debug=1&saveTest=your-id`。

## 包内容与来源

`src/`：源码和运行素材；`tools/tests/`：离线测试及最少必要素材夹具；`dist/`：已构建可部署版本；`licenses/` 与 `THIRD_PARTY_NOTICES.md`：第三方许可；`ASSET_PROVENANCE.md` 与 `public/provenance/`：素材来源、哈希和许可资料范围；`DELIVERY.json`：固定构建时间与交付配置。

这是当前工作区的独立交付快照，另含当前场景/角色/商店/宠物的精选 Blender 工作文件和制作脚本。不含 Git 历史、历史截图、依赖目录、内部部署工具及接收日志的服务。开发配置、日志接收器和旧遥测脚本的两组测试随对应功能一起排除，具体文件见 DELIVERY.json。其他游戏的源码不包含在交付中。

构建时间固定在 DELIVERY.json 中，重复构建应生成相同的 dist 文件内容。

## 源码与数值接续

入口、模块、干净构建及部署步骤见 `docs/SOURCE_GUIDE.md`；数值的当前值、单位、约束和实际消费者见 `docs/PARAMETERS.md`、`docs/parameter-catalog.json`。渲染固定 60 帧上限。素材来源与本次许可资料范围见 `ASSET_PROVENANCE.md`；Tripo3D、Mixamo 授权证明按用户要求不附。本包不把构建/模拟验证等同于基准真机验收。

新增语言仅添加 `src/game/i18n/locales/*.json`；完整格式和交付源码一致性说明见 `docs/I18N_DELIVERY.md`。本轮验证范围见 `docs/VALIDATION.md`。
