# Gemini Drive 交付归档（2026-10-16）

**来源**：Gemini 上传至 Drive 的 2026-10-16 批次（整合方审读见 `notes/`）。  
**仓库状态**：`status` 为 **authored / checked**，**不是 installed**。  
**安装记录**：`production/integrations/gemini-2026-10-16/install.json`

规范以 main 的 `docs/reference/ai-install-spec.md`（`aetheria-install/1`）为准；本目录内 zip 若含改写版安装规范，**一律不合入**。

## 根目录文件

| 文件 | 说明 |
| --- | --- |
| `aetheria-alpha-core-20261016_9c7a.zip` | 全量工作树快照（落后 main）；**仅归档，禁止解压覆盖工程** |
| `aetheria-nsfw-tf-update_2411.zip` | NSFW 缺口补丁包（含 `aetheria-nsfw-gap-fixes.patch`、词批 b0018 等） |
| `aetheria-p0-fixes_db5d.patch` | 与 zip 内 gap patch **字节相同**；名为 P0，实质为 NSFW |
| `aetheria-p0-modified-files_0e4d.zip` | 旧 P0 重发；内含被改写的 `ai-install-spec.md` → **不合入** |
| `Aetheria-Folio_d980.html` | 离线单文件可玩构建产物，非源码真相 |
| `十二题材-B1B2-24张任务卡.zip` | 外发任务书 / 任务卡，非成品词条 |
| `words-validate.log` | 协作包 v1.3 `validate-delivery` 输出 |
| `words-receipt.json` | words 车道校验收据（`checked`，未实装） |
| `patch-apply-check.log` | `git apply --check` 对 main 的失败记录 |
| `verify-main.log` | 本分支基线 `npm test` 完整日志 |

## `words/` 子目录

| 文件 | 说明 |
| --- | --- |
| `B1-*-delivery_*.json` ×5 | 五题材 B1 环境词条（各 65 条） |
| `B2-*-delivery_*.json` ×5 | 五题材 B2 人物形态（各 70 条） |
| `B3-generic-delivery_d09a.json` | 通用 B3（135 条） |
| `CONTENT-NPC-delivery_8aa7.json` | 与 main `production/quest-authoring/personal-deliveries/` **字节相同**（`0579634` 已装） |
| `CONTENT-JOBS-delivery_7bfc.json` | 同上，重复归档 |

协作包待审副本（与上表 B1–B3 相同）：`production/collaboration-pack/incoming/gemini-2026-10-16/`。

## `notes/` 子目录

| 文件 | 说明 |
| --- | --- |
| `审读结论.md` | 整合方逐条审读（2026-10-17 SGT） |
| `给Gemini-还缺什么-v2.md` | 返修清单（转发 Gemini） |

## 已尝试、未合入

- **NSFW patch**：`git apply --check` 在 `0579634` 上失败 4 文件：`pack.json`、`build-adventure-content.mjs`、`loader.ts`、`conditions.ts`（基线 commit `403e5a5` 不在仓库）。
- **规范**：任何「四层架构」改写版 `ai-install-spec.md` 不得替换 main。
- **P0 zip / core zip**：只保留在本目录。

## 后续

1. Words：补交付头、去重 12 条、编辑审定后写入 `content/prose/` 链（参见 `docs/reference/b-content-installation-2026-10-15.md`）。  
2. NSFW：按 `notes/给Gemini-还缺什么-v2.md` 拆三车道 diff 并重基于 main。  
3. 十二新题材 B1/B2 成品尚未交付。
