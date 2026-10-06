# RF0 基线与迁移记录

## 当前启动与帧顺序

- React 创建借用的 Scene、相机、角色节点与半球/方向光。
- 启动并行准备 Rapier + 出生点体素与表层资产。资产下载 4 路、最多 8 个任务/租约、4 MiB 预留解压缓冲；单模型解码、2 个 KTX worker，纹理分批上传。
- 两路完成后绑定 GameSession、裂痕订阅和传送台展示；创建普通场景容器，准备各地下房间。
- 应用初始相机/环境/表层效果，再预热 shader；昼夜在预热期间变化则重新应用后预热。
- 唯一 RAF 经 RenderSchedule 调用 R3F advance。模拟 callback 先执行，priority=1 callback 提交绘制；实际首帧提交后完成加载。
- 模拟帧：消费视角 → 普通场景附近碰撞 → 环境/装饰效果 → 固定步进（体素 recenter/process → 等待传送/落位 → 物理 tick → 业务位置更新）→ 角色插值 → 相机 → 矩阵更新/选格/攻击 → 裂痕与状态统计。

## 所有权基线

| 资源 | 现有持有者 | 迁移注意事项 |
| --- | --- | --- |
| Canvas renderer、Scene、相机、角色节点和主光 | React/R3F | 子模块借用，不销毁 renderer |
| 环境天空 cubemap/球面、局部照明 | 原入口 effect | RF1 交给 EnvironmentController；恢复 Scene 背景/雾/环境 |
| 物理世界和体素 worker/管线 | 入口 runtime | 碰撞句柄先移除，物理世界最后 dispose |
| 普通视觉和普通碰撞 | RoomFacilities | RF2 独立化；普通视觉常驻 |
| 模型模板/实例共享的几何、材质、纹理 | StaticSurface 返回树，递归释放去重 | RF3 必须统一整个资产包的去重释放，不对单个 clone 释放共享资源 |
| 表层噪声/发光 mask 等 | SurfaceDetails，经 userData 回调释放 | 明确句柄替代隐式控制依赖；避免重复释放 |
| 业务订阅/调试全局接口 | 入口 effect | 退出和失败均解除，迟到异步结果不重新挂接 |
| 绘制栅栏/性能查询 | 独立 effect | 保留独立释放，不改变提交策略 |

## 公开基线

当前测试入口，1280×720、同出生点、日/夜各一次截图，未发现页面异常。文件：`artifacts/runtime-refactor/before/{day,night}.png`、`startup.json`。对应入口源码备份在同目录父级，供本轮机械迁移对照，不是新资产复用来源。

浏览器是公开入口上的桌面 Chromium SwiftShader，不能作为真实设备帧率结论。
