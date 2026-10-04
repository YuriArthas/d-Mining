# Blender 方块与夜间矿场

用户在本轮明确授权自行用 Blender 制作方块和贴图；该授权仅替代矿棚三种方块的 Tripo 要求。其他场景组件保留各自的 Tripo 来源。

## 方块资源

三个 2 米标准立方体采用 9 毫米微倒角，保留宽平面；布局仍以 2 米递增，隐藏拼接重叠缩小为 12 毫米。木柱有简洁纵向纹理与端面年轮，奶白包边采用低对比线纹，蓝色屋顶采用大块瓦面纹样。纹理不包含烘焙阴影或高光；不存在法线、ORM 或额外纹理。

|组件|三角面|颜色贴图|打包大小|
|---|---:|---|---:|
|grid-mine-timber-blender|44|128×128|5109 字节|
|grid-mine-trim-blender|44|128×128|1901 字节|
|grid-mine-roof-blender|44|128×128|2235 字节|

- 生成命令：`blender -b --python tools/blender/build-mine-blocks.py`。
- 配方：[生成脚本](../../../../tools/blender/build-mine-blocks.py)。源文件位于 `assets-source/quarry-v2/grid-mine-{timber,trim,roof}-blender/`，每件保留 `source.blend`、`color-128.png`、`model.glb`、`result.json`。
- `.blend` 内打包纹理，便于继续编辑；颜色空间明确为 sRGB。
- 运行时资源压缩为 KTX2 UASTC 完整 mip 链 + Meshopt + gzip，不改变源模型面数，不放大贴图。
- 三个模块继续实例化复用；物理仍采用独立简化建筑外壳。没有改动矿物逻辑、选格或背包。
- Blender 资源使用 `generationId` 标识，记录脚本哈希、源模型哈希及最终打包哈希，不冒充 Tripo 任务。

当前完整清单见 [assets.json](assets.json)：65 种模型、1098 次摆放，独立面数 132855、摆放面数 624345、模型传输 20837568 字节。相比前一轮摆放面数减少 31968。

## 夜景

`SurfaceEnvironment` 用天空着色器生成深蓝渐变、疏星、月轮、月晕和轻薄云层，可见天空直接按屏幕分辨率绘制，避免小尺寸天空盒放大星点；同一个着色器一次性捕获为 128² 六面环境光贴图，不下载额外大幅全景贴图，也不每帧烘焙。退出时释放捕获目标、天空几何与着色器。

月光方向与可见月亮保持一致，环境底光采用蓝色调。矿口保留暖色作业光；矿棚正面、商店和售卖处各增加独立暖色区域灯，阴影贴图分别为 512²。矿口灯为 1024²。照明配置集中在 `world/SceneLighting.ts`，光源由 `SceneLightingRig` 管理，仍独立于装饰灯模型；退出时释放四个区域灯的阴影资源。

普通场景仍不按距离卸载，表层不加远景雾裁剪。地下主题灯光保持原有配置，返回表层恢复夜空与区域灯。

## 验证记录

先发布至 [Mining 测试版](https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html)，再做公开桌面检查。正式 Mining 未覆盖。

- 170 项测试通过；后续区域灯释放检查覆盖四个阴影资源，资源检查覆盖 authored-color 来源与 128² 压缩 mip 链。
- 静态建筑几何检查：360 次相机位置检查均通过，矿口无模型阻挡，1024 个采样位置上方均有屋顶。
- 公开电脑版检查正常退出（exit 0）：审阅矿棚正面和仰视星空两张最终画面，确认木纹、整齐接缝、清晰星点和月亮。真实采矿与自动售卖、普通场景保持驻留、地下往返和退出列表均通过，页面与 WebGL 错误列表为空。
- 证据保存在 `artifacts/block-night/`：`public-report.json`、`facade.png`、`night-sky.png`、`publish.log`、`tests.log`、`resource-checks.log`、`geometry.log`。软件浏览器运行结果不代表真机帧率或用户美术验收。
