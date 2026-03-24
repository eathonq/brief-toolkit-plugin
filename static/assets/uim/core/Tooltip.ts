/**
 * Tooltip.ts - 提示框静态类
 * @description 该类提供全局访问接口,便捷调用显示、关闭提示框等方法，依赖于 IViewManager 的 showTooltip 和 closeTooltip 方法实现具体功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/tooltip}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-01-30
 * @modified 2026-03-12
 */

import { IViewManager, TooltipData } from "./IViewManager";

/** 提示框静态类，便捷调用显示、关闭提示框等方法 */
export class Tooltip {
  private static _currentViewManager?: IViewManager;
  static bind(viewManager: IViewManager): void {
    Tooltip._currentViewManager = viewManager;
  }
  static unbind(viewManager: IViewManager): void {
    if (Tooltip._currentViewManager === viewManager) {
      Tooltip._currentViewManager = undefined;
    }
  }
  private static checkCurrentViewManager(): boolean {
    if (!Tooltip._currentViewManager) {
      console.warn("Tooltip: currentViewManager is not set.");
      return false;
    }
    return true;
  }

  /** 提示框计时器列表 */
  private static _timerList: any[] = [];

  /**
   * 显示提示框（同名提示框同时只能显示一次，其它多次则通知数据更新）
   * @param content 提示内容 
   * @param timeouts 超时时间，单位秒（默认为一直显示）
   * @param isClose 是否显示关闭按钮（默认为不显示）
   * @param name 提示框名称
   */
  static show(content: string, timeouts?: number, isClose?: boolean, name?: string): void;
  /**
   * 显示提示框（同名提示框同时只能显示一次，其它多次则通知数据更新）
   * @param data 提示框数据
   * @param name 提示框名称 
   */
  static show(data: TooltipData, name?: string): void;
  static show(...args: any[]): void {
    if (!Tooltip.checkCurrentViewManager()) {
      return;
    }

    let [content, timeouts, isClose, name] = args;
    let data: TooltipData;
    if (typeof content === "string") {
      data = { content, timeout: timeouts, isClose: isClose === undefined ? true : isClose };
    } else {
      data = content;
      name = timeouts;
    }

    let timer: any;
    const doTimeout = () => {
      data.timeoutCallback?.();
      if (timer) {
        const index = Tooltip._timerList.indexOf(timer);
        if (index >= 0) {
          Tooltip._timerList.splice(index, 1);
        }
        timer = null;
      }
    };
    // 给关闭回调套一层，确保在点击关闭按钮时也能清除计时器，避免计时器和界面状态不一致问题
    const _closeCallback = data.closeCallback;
    const doCallback = () => {
      if (timer) {
        clearTimeout(timer);
        const index = Tooltip._timerList.indexOf(timer);
        if (index >= 0) {
          Tooltip._timerList.splice(index, 1);
        }
        timer = null;
      }
      _closeCallback?.();
    };
    data.closeCallback = doCallback;
    const isShow = Tooltip._currentViewManager.showTooltip(name, data);
    if (!isShow) {
      return;
    }
    if (data.timeout > 0) {
      timer = setTimeout(doTimeout, data.timeout * 1000);
      Tooltip._timerList.push(timer);
    }
  }

  /**
   * 关闭提示框
   * @param name 提示框类型名称
   */
  static close(name?: string): void {
    if (!Tooltip.checkCurrentViewManager()) {
      return;
    }

    Tooltip._currentViewManager.closeTooltip(name);
  }
}
