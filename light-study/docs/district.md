# 松风四坊：田字小街区

公开入口：<https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html>。

用户确认制作田字街区，并明确 5 MB 为参考而非硬限制。本轮仍使用 Three.js 0.186.1 WebGPU/TSL；按 CloudAI-X 套件的 fundamentals、geometry、lighting、animation、asset-pipeline 与 performance 工作流程制作和核验，未更换引擎。

## 场景与操作

- 约 56×56 m，道路宽 6 m；外围完整环路和中央十字路分出四坊。16 栋 1–2 层建筑围成四个小院，提供商店、工坊、客栈等外观；屋后和侧面也有完整立面，建筑不做室内进入功能。
- 新建 Blender 闭合几何：台阶、石路、门窗、檐口、烟囱、招牌、遮棚、井、长凳、桶箱，以及粗树干/少量整块树冠。没有导入旧模型或用减面生成新资产。共 642,264 三角面、5,408 个制作对象，导出 64 个材质/空间组；运行时保持场景常驻，仅正常视锥剔除。
- 默认夜晚、静态灯、持续提交帧。工具栏提供全景/街口/街中/转角、巡游、夜晚/晴日；拖动环视、滚轮缩放、H 隐藏界面。
- 固定巡游为 30 秒闭环，以时间和路线弧长推进，拐角平滑，暂停/切后台不把等待时间算作移动。巡游只有相机在运动，灯和场景物体保持静态。
- 性能面板分别提供“巡游 30 秒并上报”“定点 30 秒并上报”，保存最近最多 1800 帧、GPU 样本与分布、实际提交 FPS、设备/分辨率/构建/相机轨迹。测量期间切后台、改变尺寸或出现新管线会明确拒绝污染的测量。报告沿用公开站点现有持久化接口。

## 静态灯架构

12 盏固定暖灯在 Blender Cycles 中一次烘焙 diffuse direct + indirect，不包含表面底色。32 samples、2 次漫反射反弹、发光半径 0.22 m；柱子和建筑参与软阴影，灯笼的玻璃和小金属笼不遮住内部光源。每件接收物有独立的 UV1，4096² 图集、12 px 边缘延展。

运行时只采样一张合并光照图，将 RGBM 解码的 diffuse radiance × π 作为 IrradianceNode 接入 PBR，再乘实际表面底色。没有 12 盏实时 PointLight 或逐灯 PCSS 循环。天空环境、太阳/月光、环境高光、接触 AO、4× MSAA、灯体发光光晕保持实时；太阳/月光阴影缓存，仅改变模式时更新。正常帧为 8 个通道。

边界：灯照明和局部软阴影是静态烘焙，不能随物件移动更新，也没有单独的局部灯光镜面反射；现阶段没有动态人物或移动灯。贴图中的法线细节已进入静态灯烘焙。白天关闭暖灯烘焙贡献，使用原暖阳/蓝天/地面补光配置。

## 资源账目和精度

构建 `district-vfhisCfi.js`，完整部署包 31 个文件、**11,230,490 字节**。首个同街区参考包 21,436,030 字节，减少约 47.6%。全部运行依赖在当前独立入口内，无外部 CDN 或藏到其他目录的必需资产。

| 内容 | 字节 |
| --- | ---: |
| 模型 Brotli 表示 | 4,042,980 |
| 4096² 合并光照图 | 5,483,066 |
| 21 张材质贴图及材质清单 | 708,132 |
| 布局和光照元数据 | 7,369 |
| Three.js/解码器/场景脚本、CSS、HTML、说明 | 988,943 |
| 合计 | **11,230,490** |

线上目录与构建目录实际分配磁盘空间均为 11,309,056 字节。5 MB 拒绝发布的旧门槛已删除，保留清单、哈希、符号链接和资源完整性校验。制作 blend、原始 GLB、烘焙浮点数据、实验和旧版恢复归档仍存于开发目录，不参与网页加载，也不计入部署包；这不是整台服务器的磁盘用量。

- 原始 GLB 为 66,962,404 字节。Meshopt 使用共同的 16-bit 场景位置格、16-bit 法线和 UV1；顶点颜色（包括 >1 的值）与材质 UV0 保持浮点精度。位置步长约 0.87 mm，光照 UV 步长约 0.0625 texel；没有减少三角面。派生 GLB 为 18,374,764 字节，再以标准 HTTP Brotli 提供。压缩后 642,264 面、无零面积三角形，384 个属性/索引数组解码核对；三角索引允许等价循环换序但保留绕序。
- 光照图颜色量化到 RGB5，HDR 乘数保留 8 bit，随后使用无损 WebP 存储。它**不是相对原烘焙的无损编码**：相对 float16 光照参考，绝对 radiance 误差 mean 0.000784 / P99 0.006141 / max 0.636189。没有降低图集尺寸。保留了精度更高的原始参考和截图，作最终画面对照。
- 材质图继续无损 WebP，尺寸和解码像素不变。GLB 量化属性加载后先展开成浮点数，再应用 glTF 变换和空间合批，避免向整型位置写入世界坐标造成渲染损坏。
- glTF validator 没有报 error/warning，但不支持验证 EXT_meshopt_compression，且不能理解外部运行时对 UV 的用途；解码数组校验和公开 loader 实测补充其能力边界。

来源记录：`artifacts/district-asset.json`、`district-compression.json`、`district-compressed-geometry.json`、`district-light-asset.json`、`district-transfer.json`。Blender 源文件和生成脚本分别为 `source-art/district.blend`、`tools/blender/build_district.py`；Tripo 任务 ID 为 null，未伪造生成记录。

## 验证与性能边界

先发布，再对公开 URL 做画面和交互检查。T3 preview 在本轮明确返回 AppArmor sandbox unavailable，使用已有 Playwright/Chromium/SwiftShader 工作流。证据位于 `artifacts/district-public/`。

- `reference` 为未量化参考，`encoded-r1` 为最终模型/光照编码的日夜六视角；最后仅调整巡游朝向，固定视角图像与资源未再改动。六图 RGB 平均绝对差为 0.066–0.277 / 255，P99 为 1–5 / 255；轮廓/阴影边缘存在最大 64–106 / 255 的稀疏差异，不能称逐像素一致。参见 `encoding-comparison.json`。
- 原始素材校验、TypeScript 构建、15 项路线/帧率/计时/历史测试通过。解码后的几何检查没有无效或零面积三角形。
- 模型以 256 KiB/s 限速从公开 URL 下载、解码后与派生 GLB 哈希完全相同；发布器同时验证了所有 31 个公开文件和 1,116 个其他游戏文件不变。
- 最终巡游取景修正版 `district-vfhisCfi.js` 的暂停/恢复、三个路线取样视角和 30 秒报告通过；报告 `ac66cd73-dfc3-4d1a-882b-022ddf21b7b5` 保存 7 个有效测量帧，1 个 GPU 样本，零新增管线/program。SwiftShader 提交速率 0.214 FPS 仅用于确认采集链路，样本量不足以评价 GPU 分布或实机目标。
- 自动化脚本曾出现两个等待/选择器问题：夜晚选择器同时选中 body 与按钮，已缩小到 `button[data-light]`；改变视口后先于 resize 事件读取到了旧 buffer 宽度，改为等待 renderer 尺寸更新后继续。分别保留 `route-locator-failure.json` 与 `resize-event-wait-failure.json`。页面未产生对应加载或渲染异常。
- RGBM 的 alpha 用作 HDR 乘数。额外核对了实际 WebGPU external-image 上传/readback，在 alpha=1/2/5/10/20/100/200 的七个选定 texel 上与原始解码 RGBA 一致，避免把浏览器的图片上传精度当成未验证前提；此项仅覆盖当前 Chromium 后端。

最终默认页检查通过：静态连续提交、鼠标环视、H 隐藏/恢复、960×640 ↔ 1100×700 resize、受控 visibility 事件停止/恢复，以及实际点击定点 30 秒上报。报告 `4b899aa7-bdae-4319-9a39-f88b832b9293` 保存 10 个有效测量帧，完整历史 35 帧；无控制台错误。visibility 事件由测试注入，仅证明应用处理逻辑，不冒充操作系统级后台生命周期验收。证据在 `interactions/check.json` 和 `interactions/performance.png`。

GPU 中位数 ≤3 ms / P95 ≤5 ms 仍是实机目标。软件 GPU 的时间不代表 iPhone 或笔记本性能，资源压缩也不等于 GPU 每帧加速。相对于旧版三灯街景，此版本改变了场景和静态灯架构，不对跨场景数据宣称精确加速比。

复现制作：

```sh
blender -b --python-exit-code 1 --python tools/blender/build_district.py
blender -b --python-exit-code 1 --python tools/blender/bake_district.py
python3 tools/finish-district-bake.py
npm run publish
node tools/check-district.cjs final
```

公开发布器校验全部当前资源的实际公共响应哈希，以及其他游戏文件不变。正式 Mining、mining-test、surface-study 均不在本轮修改范围。
