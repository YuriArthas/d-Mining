# V18：关闭实时水面反射作手机性能对照

用户报告：iPhone 13 Pro、Edge，V17 约 30 FPS。按要求将公开 Mining 测试版默认改为 `reflection=off`。

关闭时不执行镜像场景捕获，水 shader 不采样倒影、不混入 Fresnel 倒影色；保留现有水深、透明度吸收系数、波纹、直接光照、场景内容、分辨率和两帧提交队列。不是冻结上一帧倒影。

`?reflection=live` 可以恢复原来的实时倒影以便同机位对照；`?debug=1` 的诊断中默认应为 `reflectionMode: off`、`reflectionCalls: 0`，首次载入后的反射 captures 为 0。

正式 Mining 未改。公开桌面验证脚本：`tools/check-reflection-off.cjs`；证据：`artifacts/reflection-off-v18/`。桌面软件 GPU 验证只确认关闭生效，手机帧率以用户实际设备为准。
