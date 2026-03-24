/**
 * Views.ts - 视图静态类
 * @description 该类提供全局访问接口,便捷调用显示、关闭视图等方法，依赖于 IViewManager 的具体实现。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/views}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-12
 * @modified 2026-03-12
 */

import { IViewManager } from "./IViewManager";

/** 视图静态类，便捷提供全局调用显示、关闭视图等方法 */
export class Views {
  private static _currentViewManager?: IViewManager;
  static bind(viewManager: IViewManager): void {
    Views._currentViewManager = viewManager;
  }
  static unbind(viewManager: IViewManager): void {
    if (Views._currentViewManager === viewManager) {
      Views._currentViewManager = undefined;
    }
  }
  private static checkCurrentViewManager(): boolean {
    if (!Views._currentViewManager) {
      console.warn("View: currentViewManager is not set.");
      return false;
    }
    return true;
  }

  /**
   * 获取所有视图名称（模板表中的视图）
   * @returns 所有视图名称
   */
  static getAllViewNames(): string[] {
    if (!Views.checkCurrentViewManager()) {
      return [];
    }
    return Views._currentViewManager.getAllViewNames();
  }

  /**
   * 判断视图是否在最上层
   * @param name 视图类型名称
   * @returns 是否在最上层
   */
  static isTopView(name: string): boolean {
    if (!Views.checkCurrentViewManager()) {
      return false;
    }
    return Views._currentViewManager.isTopView(name);
  }

  /** 获取当前显示的最上层视图名称 */
  static getCurrentViewName(): string {
    if (!Views.checkCurrentViewManager()) {
      return null;
    }
    return Views._currentViewManager.getCurrentViewName();
  }

  /**
   * 显示视图（该视图已经存在则关闭之前所有视图显示该视图）
   * @param name 视图类型名称
   * @param data 视图数据
   */
  static showView(name: string, data?: any): void {
    if (!Views.checkCurrentViewManager()) {
      return;
    }
    return Views._currentViewManager.showView(name, data);
  }

  /**
   * 显示视图并替换当前视图（该视图已经存在则取出该视图显示替换）
   * @param name 视图类型名称
   * @param data 视图数据
   */
  static showAsReplace(name: string, data?: any): void {
    if (!Views.checkCurrentViewManager()) {
      return;
    }
    return Views._currentViewManager.showAsReplace(name, data);
  }

  /**
   * 显示视图做为根视图（该视图已经存在则取出该视图做为根视图）
   * @param name 视图类型名称
   * @param data 视图数据
   */
  static showAsRoot(name: string, data?: any): void {
    if (!Views.checkCurrentViewManager()) {
      return;
    }
    return Views._currentViewManager.showAsRoot(name, data);
  }

  /**
   * 视图后退（返回上一个显示的视图）
   * @param data 视图数据
   * @returns 是否成功返回上一个视图
   */
  static backView(data?: any): void {
    if (!Views.checkCurrentViewManager()) {
      return;
    }
    return Views._currentViewManager.backView(data);
  }

  /**
   * 关闭视图
   */
  static closeView(name?: string): void {
    if (!Views.checkCurrentViewManager()) {
      return;
    }
    return Views._currentViewManager.closeView(name);
  }
}