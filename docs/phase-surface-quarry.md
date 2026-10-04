# S2：Image 2.5 + Tripo 矿场院落（替换已作废的 Sunvale）

## 目标与范围

用户要求完全重做场景。新布局用青蓝瓦工坊、珊瑚瓦收购屋、石灰岩壁和瀑布桥形成紧凑院落，前景树木、植被石岸和矿车分出层次。中央 8×8 格矿口、平地出生点、地表售卖点保留原来的游戏逻辑坐标。主角、动作、镐子和背包美术不在本轮范围内。

## 真实资产流水线

- Image API，显式请求 `gpt-image-2.5-sunburst`、high quality。使用 imagegen 技能自带 CLI；非此前的 `gpt-image-2`。
- 总体参考、七类独立资产和地面纹理：`output/imagegen/quarry-v1/`。完整提示词：`docs/art/quarry-v1/`。生成图片仅为参考，不是可玩版本截图。
- Tripo v3.1，`image_to_model` 新任务，启用 `texture=true,pbr=true,texture_quality=detailed`。原始 GLB、任务记录和渲染图保存在 `assets-source/quarry-v1/<asset>/`；树木仅重试下载，没有重复付费提交模型。
- `tools/pack-quarry.mjs` 保留完整贴图与法线贴图，以 0.0002 的相对误差阈值、锁定拓扑边界整理冗余网格；未强制达到目标面数。然后以 WebP quality92、Meshopt 16-bit position 和 gzip 打包。各资产 `build.json` 保存任务 ID、原始/最终三角形数量、包体积和 SHA256。
- 七类原始模型共 10,053,766 个三角形，误差约束整理后共 2,943,860 个；27 个摆放实例共享模型数据。压缩模型合计 48.93 MB，另有约 0.73 MB 地面贴图。原始版本 74.66 MB。整理前后贴图内容哈希一致。
- 运行时不再引用 Sunvale GLB、地形遮罩、旧草地纹理或旧表层碰撞 JSON。

## 模块边界

- `QuarryLayout.ts`：摆放配置与独立碰撞描述。生成模型先统一朝向和底部标高，再按正面宽度等比缩放。重复物体共享几何和材质。高处树木通过生成岩壁的真实网格射线寻找支撑，树根埋入岩面，避免固定高度造成悬空；出生前景补充两处植被石岸。
- `StaticSurface.ts`：异步加载、纹理/法线保留、装配、取消与释放、加载诊断。所有普通场景常驻，碰撞由 RoomFacilities 按附近范围管理。
- `QuarryGround.ts`：连续地面网格，中心精确留出 16×16 米矿口。非金属哑光材质与大尺度颜色 shader；物理地面仍由原有地形系统提供。
- `SurfaceAssetPlan.ts`：售卖圈和功能标牌，独立于生成资产。
- 蓝天、云层、太阳的天空 shader 与同源 PMREM 照明保留。生成模型采用真实纹理/法线，不替换为旧顶点色材质。

## 验证

- 静态：TypeScript 编译；148 项测试通过，更新的表层物理检查覆盖出生点、售卖点和完整矿口不被装饰碰撞堵塞，以及两栋建筑和瀑布底座的实体碰撞。
- 发布：仅 `npm run publish:preview`，正式 Mining 保持原样。游戏列表必须保留 Mining 与 Mining 测试版并列。
- 公开电脑首屏已实际截图并查看：`artifacts/first-layout-quarry-desktop-arrival.png`。据此修正高处树木落位与出生前景密度；最终版本以 `SMOKE=1 ARRIVAL_ONLY=1 DATA_ONLY=1 node tools/check-quarry.cjs` 复核公开运行状态、7 类资产/27 个实例、64 格矿口、地面留空、天空、游戏列表与退出。最终记录为 `artifacts/quarry-public-report.json`：脚本退出码 0，公开加载、矿口/地面、天空与场景常驻清单、游戏列表和退出检查通过；JS/GL/网络错误列表为空。两棵树最终基脚标高为 15.129 米和 15.664 米，来自实际加载的岩壁网格支撑。本轮未重复跑地下往返和完整采集售卖流程。
- 不做手机浏览器检查，不用软件 Chromium 帧率作为真机 60 FPS 结论。视觉是否达到用户期望仍由公开版本反馈决定。

原始完整网格公开运行无 JS/GL 报错，但软件浏览器截图两次超时。误差约束整理后的公开首屏成功取得并查看；最终位置修正采用公开运行数据复核，避免继续重复软件截图。不将软件绘制队列和测试 RAF 节流当成真机帧率或首次可玩时间。
