# Tag 旧域映射与语义说明

字典版本：aetheria/foundation@1.0.0；共 61 个定义、57 个旧域别名（generation.v1 23 个，story.v1 34 个）。完整定义、Manifest 指纹和自动反向引用见 production/lexicon-authoring/formats/v2/tag-dictionary.json。

审计提议的 aetheria:* 改用 foundation:*，因为现有 aetheria 命名空间由世界包独占。旧包原文和哈希不改，别名只在指定域解析；新包写规范 ID。

“湿润/干燥”等为环境预设，不宣称真实温湿度；ecologyTags 是环境语义的生态子集，来自同一源。service.* 从权威服务字段产生。故事主题“机械/黑胶/TF/夜间”表示题材，不证明当前身体材料、形态、TF 进度或真实时段。真实语义由查询派生。

旧“隐藏”映射为废弃兼容定义；运行和生成脚本使用显式 hidden 字段，不检查中文标签。界面按中文 label 显示；别名不跨域猜测，不把同词题材自动等同身体状态。没有更改旧主题含义。

| 域 | 旧值 | 稳定 ID | 中文名称 | 状态 |
|---|---|---|---|---|
| generation.v1 | climate.dry | foundation:setting.dry | 旱光街区 | active |
| generation.v1 | climate.forge | foundation:setting.forge | 炉巷街区 | active |
| generation.v1 | climate.frost | foundation:setting.frost | 霜港街区 | active |
| generation.v1 | climate.garden | foundation:setting.garden | 林荫街区 | active |
| generation.v1 | climate.tidal | foundation:setting.tidal | 咸汐街区 | active |
| generation.v1 | climate.wet | foundation:setting.wet | 湿雾街区 | active |
| generation.v1 | ecology.canopy | foundation:ecology.canopy | 树冠生态 | active |
| generation.v1 | ecology.fern | foundation:ecology.fern | 蕨类生态 | active |
| generation.v1 | ecology.kelp | foundation:ecology.kelp | 海藻生态 | active |
| generation.v1 | ecology.lichen | foundation:ecology.lichen | 地衣生态 | active |
| generation.v1 | ecology.moss | foundation:ecology.moss | 苔藓生态 | active |
| generation.v1 | ecology.shrub | foundation:ecology.shrub | 灌木生态 | active |
| generation.v1 | horticulture | foundation:context.horticulture | 园艺背景 | active |
| generation.v1 | insulation | foundation:context.insulation | 保温背景 | active |
| generation.v1 | reclamation | foundation:context.reclamation | 回收背景 | active |
| generation.v1 | saltwater | foundation:context.saltwater | 盐水背景 | active |
| generation.v1 | service.clinic | foundation:service.clinic | 诊疗服务 | active |
| generation.v1 | service.commons | foundation:service.commons | 公共空间 | active |
| generation.v1 | service.home | foundation:service.home | 住宿服务 | active |
| generation.v1 | service.market | foundation:service.market | 市场服务 | active |
| generation.v1 | service.workshop | foundation:service.workshop | 工坊服务 | active |
| generation.v1 | solar | foundation:context.solar | 日照利用背景 | active |
| generation.v1 | waterways | foundation:context.waterways | 水道背景 | active |
| story.v1 | 城市 | foundation:theme.city | 城市 | active |
| story.v1 | 协助 | foundation:theme.assistance | 协助 | active |
| story.v1 | 生活 | foundation:theme.life | 生活 | active |
| story.v1 | 身份 | foundation:theme.identity | 身份 | active |
| story.v1 | 邻里 | foundation:theme.neighborhood | 邻里 | active |
| story.v1 | 工作 | foundation:theme.work | 工作 | active |
| story.v1 | 交易 | foundation:theme.trade | 交易 | active |
| story.v1 | 诊疗 | foundation:theme.care | 诊疗 | active |
| story.v1 | 装备 | foundation:theme.equipment | 装备 | active |
| story.v1 | 适配 | foundation:theme.fit | 适配 | active |
| story.v1 | 社交 | foundation:theme.social | 社交 | active |
| story.v1 | 休息 | foundation:theme.rest | 休息 | active |
| story.v1 | 夜间 | foundation:theme.night | 夜间 | active |
| story.v1 | 机械 | foundation:theme.mechanical | 机械 | active |
| story.v1 | 身体能力 | foundation:theme.body-capability | 身体能力 | active |
| story.v1 | 探索 | foundation:theme.exploration | 探索 | active |
| story.v1 | 平衡 | foundation:theme.balance | 平衡 | active |
| story.v1 | 风险 | foundation:theme.risk | 风险 | active |
| story.v1 | 调查 | foundation:theme.investigation | 调查 | active |
| story.v1 | 经济 | foundation:theme.economy | 经济 | active |
| story.v1 | 恢复 | foundation:theme.recovery | 恢复 | active |
| story.v1 | TF | foundation:theme.transformation | 身体变化主题 | active |
| story.v1 | 适应 | foundation:theme.adaptation | 适应 | active |
| story.v1 | 沙龙 | foundation:theme.salon | 沙龙 | active |
| story.v1 | 边界 | foundation:theme.boundary | 边界 | active |
| story.v1 | 发现 | foundation:theme.discovery | 发现 | active |
| story.v1 | 生活反馈 | foundation:theme.life-feedback | 生活反馈 | active |
| story.v1 | 兽化 | foundation:theme.beast-form | 兽化 | active |
| story.v1 | 感官 | foundation:theme.senses | 感官 | active |
| story.v1 | 黑胶 | foundation:theme.gel | 黑胶 | active |
| story.v1 | 跨日 | foundation:theme.cross-day | 跨日 | active |
| story.v1 | 失物 | foundation:theme.lost-property | 失物 | active |
| story.v1 | neighborhood | foundation:theme.gen-neighbor | 生成街区题材 | active |
| story.v1 | 隐藏 | foundation:legacy.hidden | 旧隐藏标记 | deprecated |

## 派生定义

- foundation:body.has-tail：entity，共享条件 body.matches。
- foundation:body.mechanical-tail：entity，共享条件 body.matches。
- foundation:body.can-grasp：entity，共享条件 body.hasCapability。
- foundation:time.night：world，共享条件 time.window。
- foundation:service.home：location，共享条件 environment.service。
- foundation:service.market：location，共享条件 environment.service。
- foundation:service.workshop：location，共享条件 environment.service。
- foundation:service.clinic：location，共享条件 environment.service。
- foundation:service.commons：location，共享条件 environment.service。

字典本身不含概率、TF 效果、行为或可变状态。定义来源由 Registry.provenance 返回原包 id/version/hash；引用索引由内容扫描生成，不能手动赋予角色状态。
