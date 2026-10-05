# V24：六处烘焙接触阴影，其余无投影

基线：用户实测 V23 关闭实时阴影达到60 FPS。本轮只恢复必要的落地感，不重新开启实时 shadow map。

## 选区与生产

- 4 个矿棚柱脚：只选下方两层积木，共8件。
- 商店、售卖房底部：2个当前发货模型。
- 树实际位于3.3m等高台，不能把阴影投到0m地面；本轮排除树、草、小道具、矿物和大片屋顶/月光投影。
- 直接解码发货GLB的Meshopt几何，用与游戏一致的归一化、缩放、旋转和位置导出。没有重新生成或替换场景模型。
- Blender Cycles 离线2.5m半径接触AO，512×512，32samples。10件几何、9836三角面供烘焙使用；游戏不加载这些副本。
- 图是局部无方向的接触遮蔽，适合昼夜共用，不冒充带光照方向的整场景光照贴图。

## 运行机制与预算

一张R8灰度图，仅接到地面现有材质；世界坐标映射复用已有campWorld，按地面高度和范围限制。新增一次普通纹理读取，不新增顶点、碰撞、绘制批次或透明叠层。RGBA阴影比较纹理、实时阴影pass和caster均不启用；矿物无阴影。

- 原始灰度256 KiB，mipmap约341 KiB；运行数据JSON gzip约14.3 KiB。
- 默认“阴影：烘焙”，开关控制共享强度uniform，关闭为0。
- 昼夜照明正常保留；进入地下停用地面烘焙强度，地表恢复。
- 角色脚下原有廉价接触贴片保留。
- 材质对开/关使用相同程序，避免切换时重新编译。

## 复现与防漂移

运行 `node tools/export-contact-bake.mjs`，再运行 `blender -b --threads 6 --python tools/blender/bake-contact-shadows.py`。

Blender源文件、导出几何、来源任务及哈希在 `assets-source/quarry-v2/contact-bake/`；运行数据在 `src/game/assets/ground-details/contact-shadow.json`。模型或布局改变后，契约测试会要求重新烘焙。

9项相关测试通过：烘焙与发货模型/布局一致、UV朝向正确、6处目标覆盖且矿口和出生点留白、切换和资源释放、局部灯不再投影、草批次不变。构建与公开哈希验证通过，正式 Mining 未改。

公开检查脚本 `tools/check-baked-contact.cjs`；证据 `artifacts/baked-contact-v24/`。公开电脑软件GPU只验证功能和画面，不替代 iPhone 60 FPS 复测。

公开检查已通过（退出码0、页面无错误）：实际链接程序中无阴影比较采样器或ShadowMap uniform，仅地面出现campContact；开关前后画布、三角面、绘制次数一致。切换期间只记录到主画面绘制，无离屏pass、贴图上传或shader编译。公开机位对照已检查，证据 `comparison.jpg`、`report.json`。首次含多张截图的检查被执行环境终止，保留其已生成的公开图片；随后分离截图与计数检查，完成原始状态和API核验。
