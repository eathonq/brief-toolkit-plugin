/**
 * Guider.ts - 引导管理静态门面
 * @description 提供全局访问接口，便捷调用引导系统的所有功能。
 *              内部 Manager 通过 __guideBind / __guideUnbind 注入，外部不可见。
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2026-03-17
 * @modified 2026-06-12
 */

import { IGuideManager, GuideResult } from "./IGuideManager";

/** 引导完成状态存储接口（由外部任务系统实现） */
export interface IGuideCompletionStorage {
  /** 标记引导已完成 */
  markCompleted(key: string): void;
  /** 查询引导是否已完成 */
  isCompleted(key: string): boolean;
}

// ── 模块级私有状态 ──

/**
 * 模块级私有状态。
 * 不挂载在 Guider 类上，避免通过 pure.ts 导出暴露给外部使用者。
 */
let _currentGuideManager: IGuideManager | undefined;

/** 引导完成状态存储（由任务系统注入） */
let _completionStorage: IGuideCompletionStorage | null = null;

/**
 * @internal 绑定 Manager（由 GuideManager.instance 自动调用）
 *
 * 本函数不通过 pure.ts / index.ts 重导出，外部使用者无法访问。
 */
export function __guideBind(manager: IGuideManager): void {
  _currentGuideManager = manager;
}

/**
 * @internal 解绑 Manager
 */
export function __guideUnbind(manager: IGuideManager): void {
  if (_currentGuideManager === manager) {
    _currentGuideManager = undefined;
  }
}

/**
 * @internal 标记引导已完成（由 GuideManager 在任务完成时调用）
 */
export function __guideMarkCompleted(key: string): void {
  _completionStorage?.markCompleted(key);
}

// ── 静态门面 ──

/**
 * 引导管理静态门面
 */
export class Guider {
  /**
   * 获取当前 Manager。
   * 若未绑定则返回 undefined，各方法通过可选链安全处理。
   */
  private static get current(): IGuideManager | undefined {
    return _currentGuideManager;
  }

  // ── 进度查询 ──

  /** 获取当前引导进度 */
  static getTaskRecord(): number | null {
    return Guider.current?.getTaskRecord() ?? null;
  }

  // ── 引导控制 ──

  /**
   * 开始引导
   * @param stepIndex 起始步骤索引
   * @return GuideResult 引导结果
   */
  static startTask(stepIndex?: number): Promise<GuideResult> {
    return Guider.current?.startTask(stepIndex) ?? Promise.resolve({ completed: false, stoppedAt: 0, totalSteps: 0 });
  }

  /** 停止当前任务 */
  static stopTask(): void {
    Guider.current?.stopTask();
  }

  /** 回退到上一步 */
  static previousStep(): void {
    Guider.current?.previousStep();
  }

  /** 前进到下一步 */
  static nextStep(): void {
    Guider.current?.nextStep();
  }

  /**
   * 跳转到指定步骤（按 id 或索引）。
   * 仅在 running / paused 状态下有效。
   */
  static jumpTo(stepIdOrIndex: string | number): void {
    Guider.current?.jumpTo(stepIdOrIndex);
  }

  /** 暂停当前任务 */
  static pauseTask(): void {
    Guider.current?.pauseTask();
  }

  /** 恢复暂停的任务 */
  static resumeTask(): void {
    Guider.current?.resumeTask();
  }

  /** 当前是否正在执行引导 */
  static isRunning(): boolean {
    return Guider.current?.isRunning() ?? false;
  }

  // ── 完成标记 ──

  /**
   * 注入引导完成状态存储（由任务系统在初始化时调用）。
   *
   * @example
   * Guider.setCompletionStorage({
   *   markCompleted: (key) => sys.localStorage.setItem(`guide:${key}`, '1'),
   *   isCompleted:  (key) => sys.localStorage.getItem(`guide:${key}`) === '1',
   * });
   */
  static setCompletionStorage(storage: IGuideCompletionStorage): void {
    _completionStorage = storage;
  }

  /** 查询引导是否已完成 */
  static isCompleted(key: string): boolean {
    return _completionStorage?.isCompleted(key) ?? false;
  }
}
