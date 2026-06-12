/**
 * MessageBox.ts - 消息框静态类
 * @description 该类提供全局访问接口,便捷调用显示、关闭消息框等方法，通过 Views 统一访问 IViewManager。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/messagebox}
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2023-01-30
 * @modified 2026-06-10
 */

import { MessageBoxButtons, MessageBoxData, MessageBoxResult } from "./IViewManager";
import { Views } from "./Views";

/** 消息框静态类，便捷提供全局调用显示、关闭消息框等方法 */
export class MessageBox {
  /**
   * 显示消息框（同名消息框同时只能显示一次，其它多次取消旧 Promise 并更新为新数据）
   * @param content 消息内容
   * @param title 标题
   * @param buttons 按钮类型
   * @param defaultResult 无法显示时的默认返回值（不传默认 None）
   * @param name 消息框名称
   * @returns Promise<MessageBoxResult>
   */
  static async show(content: string, title?: string, buttons?: MessageBoxButtons, defaultResult?: MessageBoxResult, name?: string): Promise<MessageBoxResult>;
  /**
   * 显示消息框（同名消息框同时只能显示一次，其它多次取消旧 Promise 并更新为新数据）
   * @param data 消息框数据
   * @param name 消息框名称
   * @returns Promise<MessageBoxResult>
   */
  static async show(data: MessageBoxData, name?: string): Promise<MessageBoxResult>;
  static async show(...args: any[]): Promise<MessageBoxResult> {
    let [content, title, buttons, defaultResult, name] = args;
    let data: MessageBoxData;
    if (typeof content === "string") {
      data = { content, title, buttons, defaultResult };
    } else {
      data = content;
      name = title;
    }

    return new Promise<MessageBoxResult>((resolve) => {
      data.resolve = resolve;
      const isShow = Views.current.showMessageBox(name, data);
      if (!isShow) {
        resolve(data.defaultResult ?? MessageBoxResult.None);
      }
    });
  }

  /**
   * 关闭消息框
   * @param name 消息框类型名称
   */
  static close(name?: string): void {
    Views.current.closeMessageBox(name);
  }
}
