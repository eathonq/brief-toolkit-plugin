/**
 * GuideStepAction.ts - 引导步骤动作 V2
 * @description 负责执行引导步骤：定位目标节点、显示遮罩高亮、显示对话/指示器、等待用户交互。
 *              交互处理委托给 GuideInteractionHandler。
 *
 *              V2 变更：步骤切换时聚焦保持活跃，由 GuideFocus 内部处理切换动画。
 *              done() 不再清除聚焦，cancel() 清除聚焦。
 *
 * @author eathonq
 * @license MIT
 * @version v2.0.0
 *
 * @created 2023-01-30
 * @modified 2026-06-12
 */

import { Node } from 'cc';
import { CCLocatorLoop } from './CCLocatorLoop';
import { GuideStep, IGuideFocus, IGuideDialog, IGuidePointer } from './IGuideManager';
import { GuidePositionResult } from './GuidePosition';
import { GuideInteractionHandler } from './GuideInteractionHandler';

/**
 * 引导步骤动作
 *
 * 职责：
 *   - 节点定位（getNode）
 *   - 步骤编排（runStep）：聚焦 → 显示指针 → 显示对话 → 委托交互
 *   - 生命周期（prepare / cancel）
 *
 * 聚焦动画约定：
 *   - prepare() 清除聚焦 + 标记 snapNext → 下一步骤 snap 定位
 *   - 步骤正常完成：不清理聚焦 → 下一步骤 focusOn 播放切换动画
 *   - cancel()（stopTask / jumpTo / nextStep）：清理聚焦
 *
 * 交互处理委托给 GuideInteractionHandler。
 */
export class GuideStepAction {
  private _rootNode: Node = null!;
  private _guideFocus: IGuideFocus = null!;
  private _dialog: IGuideDialog | null = null;
  private _pointer: IGuidePointer | null = null;

  /** 交互处理器（条件校验 + trigger 解析 + do* 方法） */
  private _handler: GuideInteractionHandler;

  /** 当前步骤的清理函数链（用于外部 cancel） */
  private _currentCleanup: (() => void) | null = null;

  constructor(
    rootNode: Node,
    guideFocus: IGuideFocus,
    dialog?: IGuideDialog,
    pointer?: IGuidePointer,
  ) {
    this._rootNode = rootNode;
    this._guideFocus = guideFocus;
    this._dialog = dialog ?? null;
    this._pointer = pointer ?? null;

    // 注入清理链回调：handler 只管注册自己的清理，链由这里维护
    this._handler = new GuideInteractionHandler((fn) => {
      const prev = this._currentCleanup;
      this._currentCleanup = () => {
        fn();
        prev?.();
      };
    });
  }

  // ── 节点定位 ──

  private async _getNode(path: string) {
    const node = await CCLocatorLoop.locateNode(path, this._rootNode);
    if (!node) {
      console.error(`GuideStepAction: node not found: ${path}`);
    }
    return node;
  }

  // ── 生命周期 ──

  /** 下次 show 是否应 snap 定位（由 prepare 设置） */
  private _snapNext = false;

  /**
   * 任务准备：隐藏对话/指示器、清除遮罩，并标记下次 show 为 snap。
   * 由 GuideManager.startTask / _finish 调用。
   */
  prepare(): void {
    this._dialog?.hide();
    this._pointer?.hide();
    this._guideFocus.clearFocus(true); // snap：不播退出动画
    this._snapNext = true;
  }

  /**
   * 取消当前步骤（由 GuideManager.stopTask / nextStep / jumpTo 调用）。
   * 执行清理链 → 清除聚焦 → 隐藏组件 → resolve Promise。
   */
  cancel(): void {
    this._currentCleanup?.();
    this._currentCleanup = null;
  }

  // ── 步骤执行 ──

  async runStep(step: GuideStep, stepIndex?: number, totalSteps?: number): Promise<void> {
    const node = await this._getNode(step.target);
    if (!node) {
      console.warn(`GuideStepAction: 引导步骤目标节点不存在，路径: ${step.target}`);
      return;
    }

    return new Promise<void>((resolve) => {
      let resolved = false;

      /**
       * 步骤完成回调（用户交互触发）。
       * V2 变更：不清理聚焦 — 下一步骤的 focusOn 会自行处理切换动画。
       */
      const done = () => {
        if (resolved) return;
        resolved = true;
        this._dialog?.hide();
        this._pointer?.hide();
        // 聚焦保持活跃，不清除 — 步骤间连续，实现切换动画
        this._currentCleanup = null;
        resolve();
      };

      // 取消清理链（stopTask / jumpTo / nextStep / previousStep 触发）。
      // V2 设计：不在此处清除聚焦 — 聚焦保持活跃，让下一次 focusOn
      // 自然走到切换动画（hasFocus=true → _animateSwitch），避免"瞬间清除→重新淡入"的卡顿。
      // 聚焦的最终清除由 prepare()（任务开始/结束时调用）负责。
      this._currentCleanup = () => {
        this._dialog?.hide();
        this._pointer?.hide();
        // 聚焦保持活跃，不清除
        this._currentCleanup = null;
        done();
      };

      // 1. 聚焦遮罩（传入 snap 控制动画）
      this._guideFocus.focusOn(node, step, undefined, this._snapNext);

      // 2. 显示指示器
      let pointerResult: GuidePositionResult | undefined;
      if (this._pointer && step.pointer !== false) {
        pointerResult = this._pointer.show(node, step, undefined, this._snapNext);
      }

      // 3. 显示对话（排除指针所在方向）
      if (this._dialog && step.dialog) {
        const excludeDirs = pointerResult ? [pointerResult.direction] : undefined;
        this._dialog.show(node, step, excludeDirs, this._snapNext, stepIndex, totalSteps);
      }

      this._snapNext = false;

      // 4. 委托交互处理
      const trigger = this._handler.resolveTrigger(node, step);
      this._handler.dispatch(trigger, node, step, done);
    });
  }
}
