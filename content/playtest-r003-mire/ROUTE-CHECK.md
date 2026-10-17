# ROUTE-CHECK — playtest-r003-mire:event.trap

验路线日期：2026-10-17（Asia/Singapore）  
事件：`playtest-r003-mire:event.trap` · `startNode=N01` · rating=`general`  
结论：**通**（无断路；每 choice 均有免费/撤离出口）

旗标前缀：`playtest-r003-mire:flag.*`（下表省略命名空间）

---

## 1. 节点与无条件出口

| 节点 | 类型 | 无条件合法出口（撤离/免费） |
|---|---|---|
| N01 | choice | `n01.retreat` → N05 |
| N02 | choice | `n02.abandon` → N05；`n02.leave` → N05 |
| N03 | choice | `n03.drag` → N05 |
| N04 | choice | `n04.withdraw` → N05；`n04.stop` → N05 |
| N05 | exit | `onEnter`: `flag.done=true` + `event.exit` |

---

## 2. 全路径表（选项 → 下一节点 → flag 变化）

### N01 迷雾踏入

| 选项 action | 条件 | 下一节点 | flag 变化 |
|---|---|---|---|
| `n01.probe` 继续前探 | `boot_stuck=false` | N02 | `entered=true` |
| `n01.inspect` 查看泥面 | `boot_stuck=false` | N02 | `entered=true`；`assessed=true` |
| `n01.retreat` 退回干地 | （无） | N05 | `done=true`（**未**立 stuck） |
| `n01.resume_ascend` 跳过重播→上行 | `boot_stuck` ∧ ¬`leg_ascend` | N03 | （无新增；不重播陷入） |
| `n01.resume_resolve` 跳过重播→处理 | `leg_ascend` | N04 | （无新增；不重播上行） |

### N02 靴陷

| 选项 | 条件 | 下一节点 | flag 变化 |
|---|---|---|---|
| `n02.pull` 用力拔靴 | （无） | N03 | `boot_stuck=true` |
| `n02.twist` 旋转鞋跟 | （无） | N03 | `boot_stuck=true`；`assessed=true` |
| `n02.abandon` 弃物撤离 | （无） | N05 | `entered=true`；`boot_stuck=false`；`done=true` |
| `n02.leave` 先撤稍后再处理 | （无） | N05 | `boot_stuck=true`；`done=true` |

### N03 腿侧上行

| 选项 | 条件 | 下一节点 | flag 变化 |
|---|---|---|---|
| `n03.block` 手截上行 | （无） | N04 | `leg_ascend=true`；`assessed=true` |
| `n03.hem` 抓紧下摆 | （无） | N04 | `leg_ascend=true` |
| `n03.signal` 求助呼叫 | （无） | N04 | `leg_ascend=true`；`signal=true` |
| `n03.drag` 拖靴撤离 | （无） | N05 | `leg_ascend=true`；`done=true` |

### N04 挣脱·求助·撤离

| 选项 | 条件 | 下一节点 | flag 变化 |
|---|---|---|---|
| `n04.peel` 剥开粘膜 | （无） | N05 | `peeled=true`；`boot_stuck=false`；`leg_ascend=false`；`done=true` |
| `n04.help` 呼救协助 | （无） | N05 | `signal=true`；`done=true` |
| `n04.withdraw` 先撤干地 | （无） | N05 | `done=true`（**保留** stuck/ascend） |
| `n04.stop` 免费结束 | （无） | N05 | `done=true` |

### N05 离开收束

| 进入来源 | onEnter | 结果 |
|---|---|---|
| N01–N04 任一出口 | `done=true`；`event.exit` | 事件 completed；可再 `action.start`（非 active 时） |

---

## 3. 必覆盖场景

### 3.1 未粘附撤离 — **通**

`start` → N01 → `n01.retreat` → N05  
旗标：`done=true`；**无** `boot_stuck` / `leg_ascend`。

### 3.2 靴陷后离开再回（不重播） — **通**

1. N01 → N02 → `n02.leave` → N05（`boot_stuck=true`，`done=true`，事件退出）  
2. 再 `action.start`（允许非 active）→ N01  
3. 因 `boot_stuck`：前探/查看选项隐藏；出现 `n01.resume_ascend` → **直达 N03**，不重播 N02 陷入正文  

（若已 `leg_ascend`，则走 `n01.resume_resolve` → N04。）

### 3.3 上行后剥开 — **通**

N01→N02（pull/twist）→N03（block/hem）→N04 → `n04.peel` → N05  
结果：`peeled=true`；stuck/ascend unset。

### 3.4 求助 — **通**

- 路径 A：N03 → `n03.signal`（`signal=true`）→ N04 → 任意出口  
- 路径 B：N04 → `n04.help`（`signal=true`）→ N05  

### 3.5 免费结束 — **通**

任一层：`n01.retreat` / `n02.abandon|leave` / `n03.drag` / `n04.withdraw|stop` → N05 → `event.exit`。

### 3.6 主链幸福路径（参考）

N01 `probe` → N02 `twist` → N03 `hem` → N04 `peel` → N05  
旗标终态示例：`entered`、`assessed`、`peeled`、`done`；stuck/ascend 已清。

---

## 4. 断路 / 缺出口检查

| 检查项 | 结果 |
|---|---|
| N01–N04 是否均有无条件出口 | **有**（见 §1） |
| N05 是否 exit + event.exit | **有** |
| 卡死节点（仅条件选项且全假） | **无**：N01 在无 stuck 时至少 retreat；有 stuck 时 resume+retreat；N02–N04 选项均无强制条件 |
| 重播风险 | **已缓解**：再入 N01 用 resume 跳过；首次 stuck 选项在已 stuck 时隐藏 |
| 缺边（指向未定义节点） | **无**（仅 N01–N05） |
| adult / 未实现 opcode | **无**（rating general；仅 flag.set / event.*） |

**验路线结论：通（无断路）。**
