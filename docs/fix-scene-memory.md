# 矿场场景资源内存修复

用户在 Edge 无法进入并发生浏览器崩溃。上一轮只修了地形启动依赖与绘制积压，没有处理资源驻留和加载峰值，不能据此声称用户侧问题已解决。

公开旧版取证：7 类模型、27 个实例，21 张 4096×4096 WebP 贴图。约 50 MB 下载体积不代表运行时内存：仅模型纹理的 RGBA8 全 mip 链约 1792 MiB，另有解码图像、上传暂存、几何、Worker 和浏览器开销。独立 Chromium / SwiftShader 进程组以 750 ms 间隔读取 Linux PSS，峰值 4216 MiB。该数据不是用户 Edge 的崩溃转储，也不是硬件显存测量。

修正资源管理：

- 模型纹理改用 KTX2 UASTC，在 GPU 支持的块压缩格式中驻留。颜色图 512×512，法线 256×256，材质参数 ORM 128×128，均有完整 mip 链；从已编码的 UASTC 链裁去高 mip，不重复解码和重压缩。公开运行时的 21 个共享纹理源编码 mip 总量约 3.1 MiB。
- 模型解压/解析串行，纹理转码共用一个 Worker；直接解压响应流，取消旧的压缩 ArrayBuffer → Blob → 解压 ArrayBuffer 额外副本。
- 每张纹理上传后异步等待 GPU 完成，再上传下一张，避免挂载首帧集中暂存全部纹理。
- 转码完成或失败释放 Worker；场景统一释放所有材质纹理槽、共享几何和材质，关闭解码图像。共享资源去重释放，取消加载也走清理路径。
- 诊断公开每张纹理实际格式、尺寸、mip 数和编码字节，按共享 Source 去重；它不是驱动总内存。
- 资源按最多 4 MiB 分块传输，再流式解压。首次大包发布中，28～35 MB 单请求在公开浏览器连续出现 HTTP/2 下载失败；分块后的字节拼接与整包 SHA-256 完全一致，不改变资源内容。发布校验使用 curl 公共入口下载和哈希核对。

初次仅改 GPU 压缩、仍保留全部 4K 贴图的公开实测：编码纹理 448 MiB，但软件渲染进程组峰值仍为 3749.5 MiB，因此没有将这次结果判为修复完成。随后按贴图用途调整材质数据尺寸，并把表层模型按 0.1 目标比例、0.001 误差上限减面；七类模型约 294 万三角形降至约 51 万，地下装饰改为索引几何并量化属性后从约 130 MiB 降到约 24.9 MiB。天空捕获为 128、阴影图为 512。

重打包命令：KTX-Software 4.4.2 的 `ktx` / `toktx` 在 PATH 下运行 `node tools/pack-quarry-gpu.mjs workshop exchange cliff oak planted-bank ore-cart waterfall`。原始素材与旧包保留在 `assets-source/quarry-v1/`。UASTC 高质量编码比原 WebP 下载包更大，本次不声称网络加载速度改善。

检查：资产 mip、KTX2 官方校验、分块字节一致性、取消下载、资源释放、异步上传取消、启动与地形事务通过。最终公开脚本退出码 0，两次进入、实际键盘移动、退出返回列表，以及加载中退出均通过，无页面异常或下载错误。21 个共享纹理源的实际编码 mip 总量约 3.1 MiB，所有模型使用压缩纹理，7 类模型与 27 个实例均在。公开运行峰值约 662 MiB；该值包含软件 GPU 开销，不能当作用户 Edge 硬件内存验收。

同一资源检查脚本的 Chromium / SwiftShader 采样口径下，公开峰值从 4216.0 MiB 降至约 662 MiB；单次进入的稳定段约 593 MiB，第二次进入会受到 SwiftShader 分配器缓存影响。进程总内存包含软件 GPU 开销，不能将编码纹理字节当成进程总内存。

证据：`artifacts/memory-before.json`、`artifacts/memory-4k-compressed.json`、`artifacts/memory-after.json`。公开实测脚本为 `tools/check-resource-memory.cjs`；只访问 Mining 测试版，正式 Mining 不变。完整发布文件哈希见 `artifacts/preview-release.json`。
