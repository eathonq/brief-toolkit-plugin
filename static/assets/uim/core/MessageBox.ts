/**
 * MessageBox.ts - 消息框静态类
 * @description 该类提供全局访问接口,便捷调用显示、关闭消息框等方法，依赖于 IViewManager 的 showMessageBox 和 closeMessageBox 方法实现具体功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/messagebox}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-01-30
 * @modified 2026-03-12
 */

import { IViewManager, MessageBoxButtons, MessageBoxData, MessageBoxResult } from "./IViewManager";

/** 消息框静态类，便捷提供全局调用显示、关闭消息框等方法 */
export class MessageBox {
  private static _currentViewManager?: IViewManager;
  static bind(viewManager: IViewManager): void {
    MessageBox._currentViewManager = viewManager;
  }
  static unbind(viewManager: IViewManager): void {
    if (MessageBox._currentViewManager === viewManager) {
      MessageBox._currentViewManager = undefined;
    }
  }
  private static checkCurrentViewManager(): boolean {
    if (!MessageBox._currentViewManager) {
      console.warn("MessageBox: currentViewManager is not set.");
      return false;
    }
    return true;
  }

  /**
   * 显示消息框（同名消息框同时只能显示一次，其它多次直接返回 MessageBoxResult.None ）
   * @param content 消息内容 
   * @param title 标题
   * @param buttons 按钮类型
   * @param name 消息框名称
   * @returns Promise<MessageBoxResult>
   */
  static async show(content: string, title?: string, buttons?: MessageBoxButtons, name?: string): Promise<MessageBoxResult>;
  /**
   * 显示消息框（同名消息框同时只能显示一次，其它多次直接返回 MessageBoxResult.None ）
   * @param data 消息框数据
   * @param name 消息框名称 
   * @returns Promise<MessageBoxResult>
   */
  static async show(data: MessageBoxData, name?: string): Promise<MessageBoxResult>;
  static async show(...args: any[]): Promise<MessageBoxResult> {
    if (!MessageBox.checkCurrentViewManager()) {
      return MessageBoxResult.None;
    }

    let [content, title, buttons, name] = args;
    let data: MessageBoxData;
    if (typeof content === "string") {
      data = { content, title, buttons };
    } else {
      data = content;
      name = title;
    }

    return new Promise<MessageBoxResult>((resolve) => {
      data.resolve = resolve;
      const isShow = MessageBox._currentViewManager.showMessageBox(name, data);
      if (!isShow) {
        resolve(MessageBoxResult.None);
      }
    });
  }

  /**
   * 关闭消息框
   * @param name 消息框类型名称 
   */
  static close(name?: string): void {
    if (!MessageBox.checkCurrentViewManager()) {
      return;
    }

    MessageBox._currentViewManager.closeMessageBox(name);
  }
}
