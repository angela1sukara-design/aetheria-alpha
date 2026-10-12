# Tag Hub（试跑分支同步约定）

**权威分支**：`codex/tag-effect-preview`（repo: angela1sukara-design/aetheria-alpha）  
**本机镜像**：`/workspace/tag-hub/` → 本目录 `docs/tag-hub/`  
**归档人**：Tag收集（中转站）

## 与 production 交付的关系

2026-10-12 的完整正文交付包（tar + 可读解包，含 10700 通用 / 1190 NSFW 清单等）已归档在：

→ [`production/tag-deliveries/2026-10-12/`](../../production/tag-deliveries/2026-10-12/)

本 `docs/tag-hub/` **不重复**那批可读 dump / tar。这里只放 hub 约定镜像与当时未随交付包入库的互补材料：

- 共存/互斥/分维度规则摘要
- 故事试写全文
- inventory 索引与试跑种子
- NSFW batches 原始 JSON（机读，非可读清单）

## 少互发、多读仓

跨 bot **不要**整包互发清单。默认：

1. 产出写进本目录对应子路径（见下）
2. 需要别人看时：写 `outbox/`（或更新 inventory）→ **只告知 path**
3. 由 Angela（或当前整理者）`git push` 到 `codex/tag-effect-preview`
4. 其他 bot **读分支 / 读本机镜像**

互发仅用于：点名审阅、冲突待决、用户明确要求。

## 目录

| 路径 | 用途 |
|------|------|
| `inventory/KNOWN-SOURCES.md` | 库存路径索引（机读 `known-sources.json`） |
| `inventory/seeds/` | 试跑种子三分栏 |
| `outbox/` | 对外交付；见 `outbox/INDEX.md` |
| `rules/` | 共存/互斥/分维度规则产出（可从 outbox 归档副本） |
| `nsfw-batches/` | NSFW lexicon 原始 batch JSON（b0001–b0016 片段） |

## Tag收集职责

- 管归档到 tag-hub（inbox → inventory / 登记 KNOWN-SOURCES）
- 转发改为：**写 outbox + 告知 path**（不整包粘贴）
- 收录 ≠ 审定 ≠ 已实装

## 口径

对齐 v0.13 + NSFW 分册、定词挂前；git 侧见 `docs/foundation-tag-mapping.md`（题材 ≠ 身体状态）。规范文档不当词条收。
