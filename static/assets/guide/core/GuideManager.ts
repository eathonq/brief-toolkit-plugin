/**
 * GuideManager.ts - 引导管理器（全局单例）
 * @description 负责引导任务的调度、步骤推进、进度管理。
 *              全局唯一实例，不依赖 Cocos Component，可脱离场景单独测试。
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2023-01-30
 * @modified 2026-06-12
 */

import { GuideTask, GuideResult, IGuideManager } from "./IGuideManager";
import { GuideStepAction } from "./GuideStepAction";
import { __guideBind, __guideUnbind, __guideMarkCompleted } from "./Guider";

/** 引导播放状态 */
enum GuideState {
  /** 未开始 / 已结束 */
  idle = 'idle',
  /** 步骤执行中 */
  running = 'running',
  /** 已暂停 */
  paused = 'paused',
  /** 所有步骤执行完毕 */
  completed = 'completed',
  /** 被中断 */
  stopped = 'stopped',
}

/**
 * 引导管理器（全局单例）
 *
 * 每次引导只有一个 task + 一个 stepAction 配对，通过 setup() 一次性注入。
 * 通过 GuideManager.instance 访问，GuideSetting 负责调用 setup()。
 *
 * 状态机：
 * ```
 * idle → startTask() → running → 最后一步完成 → completed
 *                  running → jumpTo(n)    → running (重新进入目标步骤)
 *                  running → pauseTask()  → paused
 *                  paused  → resumeTask() → running
 *                  running → stopTask()   → stopped
 *                  paused  → stopTask()   → stopped
 * ```
 */
export class GuideManager implements IGuideManager {
  //#region 单例
  private static _instance: GuideManager = null!;
  static get instance(): GuideManager {
    if (!GuideManager._instance) {
      GuideManager._instance = new GuideManager();
      __guideBind(GuideManager._instance);
    }
    return GuideManager._instance;
  }

  static resetInstance(): void {
    if (GuideManager._instance) {
      __guideUnbind(GuideManager._instance);
      GuideManager._instance = null;
    }
  }
  //#endregion

  // 引导参数（setup 时一次性注入）
  private _task: GuideTask = null!;
  private _stepAction: GuideStepAction = null!;

  // ── 状态机 ──
  private _state: GuideState = GuideState.idle;
  /** 当前步骤索引 */
  private _currentIndex: number = 0;
  /** 总步骤数 */
  private _totalSteps: number = 0;
  /**
   * 待处理的跳转目标（-1 表示无跳转）。
   * 由 previousStep / jumpTo 设置，在 _tick 步骤完成后消费。
   */
  private _pendingJump: number = -1;
  /** startTask 返回的 Promise resolve */
  private _resolveTask: ((result: GuideResult) => void) = null!;

  //#region IGuideManager 实现

  /**
   * 设置引导参数（task + stepAction 一次性注入）
   */
  setup(task: GuideTask, action: GuideStepAction): void {
    if (!task.key || !task.steps?.length) {
      console.warn('GuideManager: 任务数据无效，缺少 key 或 steps');
      return;
    }
    this._task = { ...task, index: task.index ?? 0 };
    this._stepAction = action;
  }

  /** 获取当前任务进度 */
  getTaskRecord(): number | null {
    return this._task?.index ?? null;
  }

  /**
   * 开始引导
   * @param stepIndex 起始步骤索引（可选，默认从上次记录或 0 开始）
   * @returns GuideResult 引导结果
   */
  async startTask(stepIndex?: number): Promise<GuideResult> {
    const task = this._task;
    const stepAction = this._stepAction;

    if (!task) {
      console.warn('GuideManager: 未设置引导任务');
      return { completed: false, stoppedAt: 0, totalSteps: 0 };
    }
    if (!stepAction) {
      console.warn('GuideManager: GuideStepAction 未注入');
      return { completed: false, stoppedAt: 0, totalSteps: 0 };
    }

    this._totalSteps = task.steps.length;
    this._currentIndex = stepIndex ?? task.index ?? 0;
    this._pendingJump = -1;

    // 任务开始：确保所有组件初始状态干净（hide 所有 UI + 标记 snapNext）
    stepAction.prepare();

    return new Promise<GuideResult>((resolve) => {
      this._resolveTask = resolve;

      // 起始索引越界：直接完成
      if (this._currentIndex >= this._totalSteps) {
        this._finish(GuideState.completed);
        return;
      }

      this._setState(GuideState.running);
      this._tick();
    });
  }

  stopTask(): void {
    if (!this._task || this._state === GuideState.idle) return;

    this._task.onStop?.();

    if (this._state === GuideState.paused) {
      // 暂停时没有步骤在飞行，直接收尾
      this._stepAction!.prepare();
      this._finish(GuideState.stopped);
      return;
    }

    // running 状态：cancel 当前步骤 → _tick 检测到 stopped 后收尾
    this._setState(GuideState.stopped);
    this._stepAction?.cancel();
  }

  previousStep(): void {
    if (!this._task || this._state === GuideState.idle) return;
    const prevIdx = this._currentIndex - 1;
    if (prevIdx < 0) return;

    if (this._state === GuideState.paused) {
      // 暂停时直接切索引，resumeTask 后从新索引开始
      this._currentIndex = prevIdx;
      this._task.index = prevIdx;
      this._setState(GuideState.running);
      this._tick();
      return;
    }

    // running 状态：设置跳转目标，cancel 触发 _tick 消费 _pendingJump
    this._pendingJump = prevIdx;
    this._stepAction?.cancel();
  }

  nextStep(): void {
    if (!this._task || this._state === GuideState.idle) return;

    if (this._state === GuideState.paused) {
      // 暂停时步骤未执行或已完成，直接跳索引然后恢复
      this._notifyStepLeave(this._currentIndex);
      this._currentIndex++;
      this._task.index = this._currentIndex;

      if (this._currentIndex >= this._totalSteps) {
        this._stepAction!.prepare();
        this._finish(GuideState.completed);
        return;
      }

      this._setState(GuideState.running);
      this._tick();
      return;
    }

    // running 状态：cancel 当前步骤 → _tick 自动推进到下一步
    this._stepAction?.cancel();
  }

  jumpTo(stepIdOrIndex: string | number): void {
    if (!this._task || this._state === GuideState.idle) return;

    const targetIndex = this._resolveStepIndex(stepIdOrIndex);
    if (targetIndex < 0 || targetIndex >= this._totalSteps) {
      console.warn(`GuideManager: jumpTo 目标越界: ${stepIdOrIndex} → ${targetIndex}`);
      return;
    }

    if (this._state === GuideState.paused) {
      // 暂停时直接切索引
      this._currentIndex = targetIndex;
      this._task.index = targetIndex;
      this._setState(GuideState.running);
      this._tick();
      return;
    }

    // running 状态：设置跳转目标，cancel 触发 _tick 消费 _pendingJump
    this._pendingJump = targetIndex;
    this._stepAction?.cancel();
  }

  pauseTask(): void {
    if (!this._task || this._state !== GuideState.running) return;
    this._setState(GuideState.paused);
  }

  resumeTask(): void {
    if (this._state !== GuideState.paused) return;
    this._setState(GuideState.running);
    this._tick();
  }

  isRunning(): boolean {
    return this._state === GuideState.running;
  }

  //#endregion

  // ── 内部方法 ──

  /** 设置状态 */
  private _setState(state: GuideState): void {
    this._state = state;
  }

  /**
   * 核心驱动循环。
   *
   * 流程：
   *   1. 检查暂停 / 运行状态
   *   2. 执行当前步骤（await 等待用户交互）
   *   3. 步骤完成后通知 onStepLeave、处理跳转或前进
   *   4. 检查终端状态，否则继续循环
   *
   * 调用时机：
   *   - startTask → _tick（首次启动）
   *   - resumeTask → _tick（暂停恢复）
   *   - _tick 内部自调用（步骤之间自动推进）
   */
  private async _tick(): Promise<void> {
    const task = this._task!;
    const stepAction = this._stepAction!;

    while (true) {
      // ── 顶部状态检查 ──
      if (this._state === GuideState.paused) return;
      if (this._state !== GuideState.running) break;

      // ── 越界检查 ──
      if (this._currentIndex >= this._totalSteps) {
        stepAction.prepare();
        this._finish(GuideState.completed);
        return;
      }

      // ── 进入步骤 ──
      const step = task.steps[this._currentIndex];
      task.index = this._currentIndex;
      this._notifyStepEnter(this._currentIndex);

      // ── 执行步骤（await 用户交互；期间可能被 cancel / pause / stop） ──
      await stepAction.runStep(step, this._currentIndex, this._totalSteps);

      // ── 步骤完成后的处理 ──

      // 步骤已完成，先通知离开
      this._notifyStepLeave(this._currentIndex);

      // 处理跳转（previousStep / jumpTo 设置的 _pendingJump）
      if (this._pendingJump >= 0) {
        this._currentIndex = this._pendingJump;
        task.index = this._currentIndex;
        this._pendingJump = -1;
        continue; // 重新进入循环，执行目标步骤
      }

      // 正常前进
      this._currentIndex++;

      // 检查终端状态（_state 可能在 await runStep 期间被 stopTask() 修改，
      // TS 控制流 narrowing 无法感知跨异步的属性变更，需要显式断言类型）
      if ((this._state as GuideState) === GuideState.stopped) {
        stepAction.prepare();
        this._finish(GuideState.stopped);
        return;
      }
      // paused 在循环顶部检查，此处不需要额外处理
    }
  }

  /** 任务结束收尾 */
  private _finish(endState: GuideState.completed | GuideState.stopped): void {
    this._setState(endState);

    if (endState === GuideState.completed) {
      this._task!.onComplete?.();
      __guideMarkCompleted(this._task!.key);
    }

    const result: GuideResult = {
      completed: endState === GuideState.completed,
      stoppedAt: this._currentIndex,
      totalSteps: this._totalSteps,
    };

    this._state = GuideState.idle;
    this._resolveTask?.(result);
    this._resolveTask = null;
  }

  /** 触发步骤进入回调 */
  private _notifyStepEnter(index: number): void {
    const task = this._task!;
    if (index >= 0 && index < task.steps.length) {
      task.onStepEnter?.(index, task.steps[index]);
    }
  }

  /** 触发步骤离开回调 */
  private _notifyStepLeave(index: number): void {
    const task = this._task!;
    if (index >= 0 && index < task.steps.length) {
      task.onStepLeave?.(index, task.steps[index]);
    }
  }

  /** 将步骤 id 或索引解析为数组索引 */
  private _resolveStepIndex(idOrIndex: string | number): number {
    if (typeof idOrIndex === 'number') return idOrIndex;
    const idx = this._task!.steps.findIndex(s => s.id === idOrIndex);
    if (idx < 0) {
      console.warn(`GuideManager: 步骤 id "${idOrIndex}" 未找到`);
    }
    return idx;
  }
}
