/**
 * Views.ts - 视图静态类
 * @description 该类提供全局访问接口,便捷调用显示、关闭视图等方法，依赖于 IViewManager 的具体实现。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/views}
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-03-12
 * @modified 2026-06-11
 */

import { IViewManager } from "./IViewManager";
import { DefaultViewManager } from "./DefaultViewManager";

/**
 * 模块级私有状态。
 * 不挂载在 Views 类上，避免通过 pure.ts 导出暴露给外部使用者。
 */
let _currentViewManager: IViewManager | undefined;

/**
 * @internal 绑定真实 ViewManager（由 ViewNavigator.onEnable 自动调用）
 *
 * 本函数不通过 pure.ts / index.ts 重导出，外部使用者无法访问。
 */
export function __viewsBind(viewManager: IViewManager): void {
  _currentViewManager = viewManager;
}

/**
 * @internal 解绑 ViewManager（由 ViewNavigator.onDestroy 自动调用）
 */
export function __viewsUnbind(viewManager: IViewManager): void {
  if (_currentViewManager === viewManager) {
    _currentViewManager = undefined;
  }
}

/** 视图静态类，便捷提供全局调用显示、关闭视图等方法 */
export class Views {
  /** 视图操作错误回调（name: 视图名称, reason: 失败原因） */
  static onError: ((name: string, reason: string) => void) = null!;

  /**
   * 获取当前 IViewManager 实例。
   * 若未绑定真实 ViewNavigator，自动回退到 DefaultViewManager（Null Object），
   * 确保 ViewModel 中的调用永不因未绑定而崩溃。
   */
  static get current(): IViewManager {
    return _currentViewManager ?? DefaultViewManager.instance;
  }

  // ── 代理方法 ──

  static getAllViewNames(): string[] {
    return Views.current.getAllViewNames();
  }

  static isTopView<T extends string = string>(name: T): boolean {
    return Views.current.isTopView(name);
  }

  static getCurrentViewName(): string {
    return Views.current.getCurrentViewName();
  }

  static showView<T extends string = string>(name: T, data?: any): void {
    Views.current.showView(name, data);
  }

  static showAsReplace<T extends string = string>(name: T, data?: any): void {
    Views.current.showAsReplace(name, data);
  }

  static showAsRoot<T extends string = string>(name: T, data?: any): void {
    Views.current.showAsRoot(name, data);
  }

  static backView(data?: any): void {
    Views.current.backView(data);
  }

  static closeView<T extends string = string>(name: T): void {
    Views.current.closeView(name);
  }
}
