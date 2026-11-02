# 场景制作工作文件

Blender 5.1.2 自制建筑、自然物、大厅道具与蛋台，配合 tools/terrain 和 tools/underground 的离线 Three.js 场景生成代码。源文件、小图集、布局和逐模型生产记录随包保留，没有 Tripo 任务 ID。

这些文件不参与普通游戏构建。游戏直接使用 src/game/assets/scene 中已经打包的本地资源。进一步编辑/重新生成美术需要 Blender、KTX-Software 4.4.2、该目录 package-lock 锁定的作者工具，以及根 tools 下的导出/打包脚本。本轮未重跑完整美术流水线，不保证不同工具环境逐字节生成相同资源。

工作副本清除了内部绝对路径和服务端点。清理前后哈希、运行面数与纹理尺寸见 ../public/provenance/asset-inventory.json；许可资料范围见 ../ASSET_AUTHORIZATION.md。
