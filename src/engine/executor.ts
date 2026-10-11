import type { ActionIntent, ActionResult, GameState } from '../core/types.ts';
import { clone, freeze, stableJson } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { actionOptions, selectGameView } from './selectors.ts';
import { applyEffects } from './effects.ts';
import type { EffectContext } from './effects.ts';
import { npcPresenceTransitions } from './npc.ts';
import { revalidateDistrict } from './interaction.ts';
import { TextLibrary } from '../content/text-variants.ts';
/** 唯一写入权威。存档恢复建立新的 executor，不能通过可写 snapshot 绕过事务。 */
export class ActionExecutor {
  #state: GameState;
  readonly registry: Registry;
  readonly texts: TextLibrary;
  constructor(registry: Registry, state: GameState, texts = new TextLibrary()) { this.registry = registry; this.#state = clone(state); this.texts=texts; }
  snapshot(): GameState { return freeze(clone(this.#state)); }
  view() { return selectGameView(this.#state, this.registry, this.texts); }
  performAction(intent: ActionIntent, expectedRevision: number, requestId: string): ActionResult {
    const fail = (code: string, message: string): ActionResult => ({ ok: false, code, message, revision: this.#state.meta.revision, requestId, text: '', changes: [] });
    if (!requestId || requestId.length > 128) return fail('INVALID_REQUEST', '行动请求 ID 无效。');
    if (Object.keys(intent).some(k => k !== 'actionId' && k !== 'params')) return fail('INVALID_INTENT', '本版本未登记该行动参数。');
    if (intent.params && Object.keys(intent.params).length && (intent.actionId !== 'district:action.create' || Object.keys(intent.params).some(k=>k!=='name'&&k!=='ageYears') || typeof intent.params.name!=='string' || !intent.params.name.trim() || intent.params.name.length>40 || !Number.isSafeInteger(intent.params.ageYears) || intent.params.ageYears!<18 || intent.params.ageYears!>120)) return fail('INVALID_INTENT','角色需要1–40字姓名与18–120岁年龄。');
    const fingerprint = stableJson(intent);
    const previous = this.#state.ledger.transactions.find(x => x.requestId === requestId);
    // 必须先检查幂等，再检查旧 revision；网络重试可以获得原结果，但不同请求不能冒用 ID。
    if (previous) return previous.fingerprint === fingerprint ? clone(previous.result) : fail('REQUEST_ID_REUSED', '相同请求 ID 不能用于另一个行动。');
    if (expectedRevision !== this.#state.meta.revision) return fail('STALE_REVISION', '状态已改变，请重新选择行动。');
    const option = actionOptions(this.#state, this.registry).find(x => x.definition.id === intent.actionId);
    if (!option) return fail('ACTION_NOT_AVAILABLE', '该行动不属于当前地点或事件。');
    if (!option.available) return fail('CONDITION_FAILED', option.reason);
    const draft = clone(this.#state);
    const context: EffectContext = { budget: 64, changes: [], resolvedTexts: [], transactionId: requestId, actionId: intent.actionId };
    try {
      const effects=option.definition.effects.map(e=>e.op==='player.create'&&intent.params?.name ? {...e,name:intent.params.name.trim(),ageYears:intent.params.ageYears!}:e);
      applyEffects(effects, draft, this.registry, context);
      revalidateDistrict(draft,this.registry,context);
      // 只在全部效果成功后记录人物的实际去向；不由UI推断“任务完成所以消失”。
      const movements = npcPresenceTransitions(this.#state, draft, this.registry);
      context.changes.push(...movements.changes); context.resolvedTexts.push(...movements.texts);
      draft.meta.revision++;
      const result: ActionResult = { ok: true, code: 'COMMITTED', message: '行动完成。', requestId,
        revision: draft.meta.revision, text: [this.registry.text(option.definition.resultText), ...context.resolvedTexts].join('\n\n'), changes: context.changes };
      draft.ledger.transactions.push({ requestId, fingerprint, result: clone(result) });
      // 只有所有效果成功之后才替换权威状态；渲染、IO、AI 都不参与此次提交。
      this.#state = draft;
      return result;
    } catch (error) {
      if (error instanceof RuleError) return fail(error.code, error.message);
      return fail('TRANSACTION_FAILED', '行动结算异常，本次状态没有改变。');
    }
  }
}
