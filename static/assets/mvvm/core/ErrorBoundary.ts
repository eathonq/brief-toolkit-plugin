/**
 * ErrorBoundary.ts - 错误边界
 * @description 提供函数执行的安全包装，防止单个组件异常导致整个 MVVM 链路崩溃。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-09
 */

import type { BaseViewModel } from './BaseViewModel';

/** 全局错误处理器 */
export type GlobalErrorHandler = (error: unknown, context?: string) => void;

let _globalHandler: GlobalErrorHandler = null!;

/**
 * 错误边界工具
 *
 * - 包裹关键函数调用，捕获异常后触发全局处理器
 * - 支持关联到具体 ViewModel 实例以便调用 vm.onError()
 */
export class ErrorBoundary {
  /**
   * 设置全局错误处理器
   */
  static setGlobalHandler(handler: GlobalErrorHandler | null): void {
    _globalHandler = handler;
  }

  /**
   * 包裹一个无参函数，返回带 try-catch 的版本
   *
   * @param fn      原始函数
   * @param vm      关联的 ViewModel（可选，用于调用 vm.onError）
   * @param context 调试标签，如 "Binding.setValue" / "watch:title"
   */
  static wrap(
    fn: () => void,
    vm?: BaseViewModel | null,
    context?: string,
  ): () => void {
    return () => {
      try {
        fn();
      } catch (error) {
        ErrorBoundary._handle(error, vm, context);
      }
    };
  }

  /**
   * 包裹一个带参数的回调函数
   */
  static wrapCallback<T extends (...args: any[]) => void>(
    fn: T,
    vm?: BaseViewModel | null,
    context?: string,
  ): T {
    return ((...args: any[]) => {
      try {
        fn(...args);
      } catch (error) {
        ErrorBoundary._handle(error, vm, context);
      }
    }) as T;
  }

  /**
   * 直接执行并捕获异常
   */
  static tryRun(fn: () => void, vm?: BaseViewModel | null, context?: string): void {
    try {
      fn();
    } catch (error) {
      ErrorBoundary._handle(error, vm, context);
    }
  }

  // ──────────── 内部 ────────────

  private static _handle(error: unknown, vm?: BaseViewModel | null, context?: string): void {
    // 1. 通知关联的 ViewModel
    if (vm) {
      try { vm.onError(error); } catch { /* 忽略 onError 自身异常 */ }
    }

    // 2. 调用全局处理器
    if (_globalHandler) {
      try {
        _globalHandler(error, context);
      } catch {
        console.error('[ErrorBoundary] 全局错误处理器自身异常:', error);
      }
      return;
    }

    // 3. 兜底输出
    const tag = context ? ` [${context}]` : '';
    console.error(`[ErrorBoundary]${tag}`, error);
  }
}
