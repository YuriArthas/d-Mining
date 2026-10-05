# V22：硬件 PCF 单次过滤

V21 用户 iPhone 13 Pro / Edge 对照：正常 39.8 FPS（逻辑 1.8ms、提交 4.2ms），暂停绘制 RAF60，纯色60，关闭阴影59.9（逻辑1.0ms、提交2.9ms），每项7个样本。当前只收到前四项，未用未提供的正常后/低像素数据作判断。相较此前 V20 正常约33 FPS 有改善，但关闭阴影仍然明显更快。

## 修改

Three r186 的 sampler2DShadow 使用线性过滤：一次查找已包含2×2深度比较过滤。此前自定义稳定 PCF 叠加5次硬件查找，仅阴影软化就增加明显的逐像素开销。

V22 默认每路阴影1次硬件 PCF。保留月光、矿棚主灯的两路真实投影、贴图尺寸2048/1024、阴影深度偏移、强度及视锥判断。模型/分辨率/照明不改。其代价是阴影边缘更窄、更利落，不声称与五次宽过滤完全相同，也不称为烘焙光照。

- 默认公开入口：https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html
- 原宽过滤公开对照：https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?shadowFilter=wide
- 两种模式复制结果分别标注 V22 / 1次或5次过滤，防止混淆。

## 验证

两项 shader 测试覆盖一次/五次查找、硬件比较采样器、深度偏移、视锥条件及不修改 Three 全局 ShaderChunk。构建、公开资源哈希校验通过，正式 Mining 不变。

公开检查脚本 `tools/check-shadow-filter.cjs` 从实际送入 WebGL 的 shaderSource 确认采样次数，检查同机位两种模式的画布尺寸/面数不变、两路投影继续开启。截图及原始状态位于 `artifacts/shadow-filter-v22/`。服务器软件GPU不能作为手机性能证据；V22收益仍待同机位实测。

公开检查已完成：两种模式实际提交 shader 分别为1次/5次查找，无页面错误；同机位均为1280×720、282978三角面，两路阴影保持开启。`comparison.jpg` 为同机位对照，主要投影和场景照明保留，单次PCF边缘更窄。未作手机60FPS承诺。
