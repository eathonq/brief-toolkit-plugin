/**
 * Guider.ts - 引导管理静态类
 * @description 该类提供全局访问接口,便捷调用开始任务、加载任务和获取任务记录等方法，依赖于 IGuideManager 的 startTask、loadTask 和 getTaskRecord 方法实现具体功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/guide/guider}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-17
 * @modified 2026-03-17
 */

import { GuideTask, IGuideManager, StartTaskOptions } from "./IGuideManager";

/**
 * 引导管理静态类
 */
export class Guider {
  //#region Manager
  private static _manager?: IGuideManager;
  static bind(manager: IGuideManager): void {
    Guider._manager = manager;
  }
  static unbind(manager: IGuideManager): void {
    if (Guider._manager === manager) {
      Guider._manager = undefined;
    }
  }
  private static checkManager(): boolean {
    if (!Guider._manager) {
      console.warn("Guider: manager is not set.");
      return false;
    }
    return true;
  }
  //#endregion

  /**
   * 开始任务
   * @param key 任务标识
   * @param options 任务选项
   * @return Promise<void> 任务完成的 Promise
   */
  static startTask(key: string, options?: StartTaskOptions): Promise<void> {
    if (Guider.checkManager()) {
      return Guider._manager.startTask(key, options);
    }
  }

  /**
   * 加载引导任务
   * @param task 引导任务
   */
  static loadTask(task: GuideTask): void {
    if (Guider.checkManager()) {
      Guider._manager.loadTask(task);
    }
  }

  /**
   * 获取任务记录的当前步骤索引
   * @param key 任务标识
   * @return 当前步骤索引，若任务不存在则返回 null
   */
  static getTaskRecord(key: string): number | null {
    if (Guider.checkManager()) {
      return Guider._manager.getTaskRecord(key);
    }
    return null;
  }
}