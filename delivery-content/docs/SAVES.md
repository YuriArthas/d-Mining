# localStorage 存档

按用户确认优先适用的 A-18/A-19，进度只使用浏览器标准 localStorage 持久化。`SaveBootstrap` 打开 `LocalStorageSaveStore`，`SaveCoordinator` 协调经济与地形快照。没有其他持久化存档路径或自动切换后端。

每个命名空间对应一个 localStorage 键，值为 JSON：`storageVersion: 1`、`head`、`progress`、`regions`。`head` 保留版本、保存序号、时间、世界标识和区域数量；`progress` 包含钱包、背包、装备、宠物、探索和引导状态。区域只保存已挖格子的稀疏差异，不保存完整矿体或操作日志。

`regions` 每项为 `[x, y, z, payload]`。完整挖空区域用 `null`；少量删除区间使用 `r` 加小端 uint16 的 Base64；碎片较多时使用 `b` 加 512 字节位图的 Base64。加载后恢复规范化删除区间，继续由世界逻辑校验可挖边界和保护层。编码压缩不会删减挖掘记录。

每次合并本轮脏区域与先前区域，然后一次 `setItem` 替换完整快照。写入成功后才确认脏数据；写入抛错时，上次成功值保持不变，当前未保存修改继续等待重试。浏览器配额因平台而异，编码不能保证无限进度容量；配额耗尽、访问权限失败或内容损坏均显示错误，不清档、不重置、不切换存储方案。

普通保存窗口约两秒，重要交易请求立即保存；页面隐藏和离开时请求 flush。Web Locks 只用于限制单个可写会话，不保存进度；仅 HTTPS 且浏览器支持该 API 时启用，HTTP（包括 localhost）跳过锁，不阻断启动。无锁时不保证多标签页互斥。提交前检查 expectedRevision，过期会话发生冲突后停止自动覆盖。

| 入口 | localStorage 键 / 行为 |
| --- | --- |
| `/games/mining/` 普通入口 | `mining:production:economy-v2` |
| 其他普通入口 | `mining:test:economy-v2` |
| 精确 `?debug=1` | 独立内存会话，刷新清空，不持久化 |
| `?debug=1&saveTest=id` | `mining:acceptance:id`，与玩家存档分开 |
| 调试接口 `openTestStore(id)` | `mining:acceptance:store-id`，仅验收使用 |
| 语言偏好 | `mining.language` |

旧存储方案的数据不读取、不迁移、不删除；升级后从该站点已有的 localStorage 进度恢复，没有相应键则创建新进度。换浏览器或站点不会自动迁移；清除站点数据会删除当前进度。localStorage 数据由浏览器管理，本包不提供云端或文件存档。
