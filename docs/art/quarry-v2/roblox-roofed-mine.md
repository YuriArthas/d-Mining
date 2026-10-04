# Roblox 风格有顶矿棚

用户纠正：上轮露天石拱没顶且偏魔兽世界。整座重新生成，不继续修补旧遗迹组件。

本轮 imagegen 提示词明确指定 **modern Roblox / Mining Simulator 2 / polished colorful Roblox simulator architecture**。完整绿色双坡屋顶，暖色方木梁柱、浅色柱脚、少量金属连接件和暖色挂灯；正面敞开，两侧通透，中央无立柱、无地板。去掉旧方案风化粗石、中世纪遗迹的造型语言。围墙和其他已认可道具不调整。

使用 imagegen 技能的 API/CLI 路径调用 `gpt-image-2.5-sunburst`。提示词保存在 `docs/art/quarry-v2/references/roblox-mine.jsonl`，参考图在 `output/imagegen/roblox-mine/shaft-roblox-mine.png`，由全新 Tripo image-to-model 任务生成。面数上限仍为 10,000；贴图沿用建筑 512/256/128，GPU 压缩，不做拓扑减面。

初定外轮廓 26×26m、高 13m。内部保留完整 16×16m 矿区；生成后分别检查：6m 以下矿区无遮挡、上方屋顶完整覆盖、前门通行。相机碰撞独立使用柱体和两个斜坡凸包，不把整间房子作为实心碰撞盒。

新模型 Tripo 任务 `05e11380-312c-4cb9-b832-2d1d737cda8b`，实际 8,128 三角面，运行时传输 461,674 字节。原始与运行时 SHA256 见 `assets.json` 对应条目；旧石拱退出运行时，保留源记录。Tripo 本批使用 30 积分，完成后余额 490、冻结 0。

生成网格 1,024 个矿区采样点上方都有屋顶，下方 6m 范围均无阻挡；采样到的最低上方净空约 7.65m。按实际梁架补齐柱、侧梁、前后横梁与前山墙竖梁碰撞，360 组相机射线与真实生成网格核对无穿模；此离线数据检查不替代公开画面。报告 `artifacts/roblox-mine/geometry-clearance.json`。

164 项测试通过。公开电脑端完成出生、商店、棚内视角，64 格矿口、实际挖矿/自动出售、高角度镜头、场景常驻、地下回家与退出到列表检查，页面及 WebGL 错误为零。记录 `artifacts/roblox-mine/full-public-report.json`。

随后为展示完整高屋顶，将出生/回家点由 (0,18) 后退到 (0,26)，延长正门小路并把初始俯角调至 0.04 弧度。步行路线测试按当前起点距离计算步数，保留必须到达矿口的断言。最终视角另在重新发布后检查。

全场保持 61 种模型、808 个实例，独立三角面 139,252，全部实例 623,058；模型传输总量 21,222,918 字节（约 20.24 MiB）。

最终公开出生视角已确认能看到完整屋顶轮廓；最终启动、矿口和退出检查通过，无页面错误。证据 `artifacts/roblox-mine/final-arrival.png` 与 `final-public-report.json`。
