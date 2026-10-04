# 矿场细节扩充：当前保留 35 个独立模型

原扩充批次共 42 种，六种圆润岩壁和旧补给棚已退出运行时，改由 TimberBoundary 模块替代。其余每种对应独立 Tripo 任务。新增近景服务区、可走近的工作痕迹和成组植被。所有新模型使用同一套暖砂岩、蜂蜜木、青绿点缀的色板。

生成时限制三角面；贴图统一 512 色彩 / 256 法线 / 128 ORM 并使用 GPU 压缩。普通场景常驻，不按角色距离消失。禁止通过程序捏模型补数。

|模型|用途|位置 x,z|宽度 m|三角面上限|
|---|---|---|---:|---:|
|oak-wide|west woodland|-28, 23|9|2800|
|oak-tall|east woodland|31, 27|8|2800|
|maple-gold|arrival grove|-20, 37|8|2800|
|maple-coral|arrival grove|24, 35|7|2800|
|birch-round|mine grove|-32, -12|7|2400|
|cedar-pillow|east woodland|30, -18|7|2800|
|willow-dome|west woodland|-29, 5|8|2800|
|sapling-pair|rear garden|21, -24|5|2200|
|boulder-moss|mine grove|-16, -20|5|1800|
|boulder-ore|mineral display|26, -10|4|2200|
|shrub-round|west garden|-21, 18|4|1100|
|shrub-flower|east garden|25, 20|4|1400|
|shrub-berry|arrival garden|14, 34|4|1200|
|grass-tussock|arrival verge|-12, 29|2|900|
|flower-daisies|arrival garden|10, 28|2.5|1200|
|mushroom-cluster|west woodland|-25, 30|2|1300|
|workshop-hut|east workshop|31, 0|9|6500|
|warehouse-shed|mine storage|-26, -22|7|6000|
|assayer-stall|exchange court|20, 17|5|4500|
|well-stone|arrival rest area|-25, 26|3.4|3000|
|tool-rack|workshop yard|25, -2|3|2300|
|workbench|workshop yard|25, 2|3|2600|
|anvil-stump|workshop yard|27, 10|2|1900|
|crate-stack|exchange freight|24, 16|3|1800|
|barrel-pair|mine storage|-20, -10|2.6|2000|
|ore-bin-copper|exchange freight|18, 10|2.4|2000|
|ore-bin-jade|exchange freight|22, 10|2.4|2000|
|sack-stack|exchange freight|18, 19|2.4|1600|
|cart-empty|mine storage|-15, -13|3|2500|
|wheelbarrow|workshop yard|29, 13|2.8|2300|
|rail-buffer|mine storage|-16, -9|3|1600|
|bench-timber|arrival rest area|-13, 24|3|1700|
|notice-board|arrival rest area|-27, 20|2.4|2200|
|fence-corner|west service court|-26, 17|5|1800|
|waystone-crystal|rear mineral garden|9, -17|3|2400|

六种旧岩壁只保留源文件和生成记录，不再打包；小道具和植被另组成多处细节组，不计入独立模型数量。保留矿口、出生点与售卖通道。任务 ID、实际面数、哈希及最终采用清单在完成后生成。
