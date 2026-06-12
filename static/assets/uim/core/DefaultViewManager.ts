/**
 * DefaultViewManager.ts — IViewManager 的默认空实现（Null Object Pattern）
 * @description 在真实 ViewManager 绑定前提供安全的空操作，确保 ViewModel 中的
 *              Views / MessageBox / Tooltip 调用永不因未绑定而崩溃。
 *              所有方法以 console.debug 记录调用，生产环境可通过日志级别屏蔽。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

import { IViewManager, ViewType, MessageBoxResult } from './IViewManager';

export class DefaultViewManager implements IViewManager {
  static readonly instance = new DefaultViewManager();

  private _log(method: string, ...args: any[]): void {
    console.debug(`[UIM] DefaultViewManager.${method} — real ViewManager not bound yet`, ...args);
  }

  // ── 查询 ──

  getViewType<T extends string = string>(name: T): ViewType {
    this._log('getViewType', name);
    return null;
  }

  checkView<T extends string = string>(name: T, type?: ViewType): boolean {
    return false;
  }

  getAllViewNames(): string[] {
    return [];
  }

  isTopView<T extends string = string>(name: T): boolean {
    return false;
  }

  getCurrentViewName(): string {
    return null;
  }

  // ── 视图操作 ──

  show<T extends string = string>(name: T, data?: any): void {
    this._log('show', name);
  }

  close<T extends string = string>(name: T, data?: any): void {
    this._log('close', name);
  }

  showView<T extends string = string>(name: T, data?: any): void {
    this._log('showView', name);
  }

  showAsReplace<T extends string = string>(name: T, data?: any): void {
    this._log('showAsReplace', name);
  }

  showAsRoot<T extends string = string>(name: T, data?: any): void {
    this._log('showAsRoot', name);
  }

  backView(data?: any): void {
    this._log('backView');
  }

  closeView<T extends string = string>(name: T, data?: any): void {
    this._log('closeView', name);
  }

  // ── 消息框 ──

  showMessageBox(data: any): boolean;
  showMessageBox<T extends string = string>(name: T, data: any): boolean;
  showMessageBox(...args: any[]): boolean {
    this._log('showMessageBox');
    // 返回 false → MessageBox.show() resolve 为 None
    const data = args.length === 1 ? args[0] : args[1];
    data?.resolve?.(MessageBoxResult.None);
    return false;
  }

  closeMessageBox<T extends string = string>(name?: T, data?: any): void {
    this._log('closeMessageBox', name);
  }

  // ── 提示框 ──

  showTooltip(data: any): boolean;
  showTooltip<T extends string = string>(name: T, data: any): boolean;
  showTooltip(...args: any[]): boolean {
    this._log('showTooltip');
    return false;
  }

  closeTooltip<T extends string = string>(name?: T, data?: any): void {
    this._log('closeTooltip', name);
  }
}
