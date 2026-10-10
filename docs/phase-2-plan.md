# 第二阶段：身体与 TF 可玩闭环

用户已在 Windows 浏览器试玩第一阶段，反馈游戏无明显问题，并授权继续。记录为用户手动运行反馈，不冒充自动浏览器验收。

本阶段沿用独立工程，保留 core/world 包原字节，通过新增 `aetheria/reshaping` 包向公开地点 Hook 追加诊室路线与行动。不修改旧 Demo。

## 最小协议

- `BodyPartDef`：已登记的部件类别、材料、能力、连接锚点及容量。
- `BodyTemplateDef`：初始节点与有向连接；两手两腿仅是人类模板的内容。
- `BodyPatchDef`：整组 `replace / attach / remove`。检查锚点、类别、容量、唯一父节点、根及连通性后提交；能力与描述只从真实图派生。
- `TFDef`：自由/剧情来源、按累计活动分钟排序的阶段、阶段可引用图补丁；不运行作者 JS。
- `TFInstance`：稳定实例/来源请求 ID、已完成阶段、活动分钟、active/paused/blocked/completed/cancelled。队列锁住实际补丁目标；暂停保留锁，取消释放锁，不退款、不回退已完成阶段。
- 新 Condition：`body.hasPart / body.hasCapability / tf.state`。
- 新 Effect：`tf.apply / tf.enqueue / tf.pause / tf.resume / tf.cancel`。自由与剧情共用图校验及原子提交；不提供任意写图的 UI 通道。
- 身体面板只呈现同一动作选择器的 `surface: body` 动作；诊室场景动作与自由塑形可以同时存在。
- 存档 schema 2；仅明确第一阶段官方 core/world 指纹可以升级，原校验通过后增加默认身体/空 TF 队列，最后重验全部状态。未知旧包仍隔离；不会覆盖旧存档直到用户点击保存。

## 本轮可玩内容

第四地点改造诊室；身体面板可试人类/狼/猫耳及有无生物尾；机械尾有15/45分钟两阶段、暂停/继续/取消、同部位冲突拒绝。完成机械尾后新增一项真实集市行动。全部新设文案/数值为 PROPOSED 测试内容。

## 验收

保留第一阶段回归；图拓扑负例、额外肢体能力预算、同部位冲突、不同部位自由塑形、多个 TF/午夜边界、读档不重结算、付费失败原子回滚、精确旧档迁移与损坏档隔离。尝试真实 Playwright 浏览器验证；若环境仍失败，明确报告，不用用户反馈代替自动检查。

本轮不宣称 M1 完整通过：NPC/路人、InteractionScene/姿势接触、装备/Slot、战斗与完整 Storylet/EventGraph 尚属后续范围。协议保持候选，未冻结为 M2。
