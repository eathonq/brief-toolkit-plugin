/**
 * pure.ts - MVVM 纯 TS 入口（零 Cocos 依赖）
 * @description 可用于单元测试、Node.js 脚本等非 Cocos 运行时环境。
 *              所有导出模块及其传递依赖均不包含 `from 'cc'` 导入。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-03-10
 * @modified 2026-06-10
 */

// ──────────── 装饰器 ────────────
export { _decorator } from './core/Decorator';
export { decoratorData, ExpandType } from './core/DecoratorData';

import { decoratorData } from "./core/DecoratorData";
/** 编辑器模式下设置显示数据 */
export function SetEditor(data: any) {
  decoratorData.setDefaultInEditor(data);
}

// ──────────── 响应式核心 ────────────
export {
  batch,
  computed,
  isProxy,
  isReactive,
  isReadonly,
  reactive,
  readonly,
  setReactiveErrorHandler,
  shallowReactive,
  shallowReadonly,
  toRaw,
  watch,
  watchEffect,
} from './core/Reactive';

// ──────────── ViewModel 基类 ────────────
export { BaseViewModel } from './core/BaseViewModel';

// ──────────── 错误边界 ────────────
export { ErrorBoundary } from './core/ErrorBoundary';
export type { GlobalErrorHandler } from './core/ErrorBoundary';

// ──────────── 类型工具 ────────────
export type {
  ViewModelOf,
  PropType,
  KeysOfType,
  FunctionKeys,
  BindingKeys,
  DeepPath,
  TypedBinding,
  WatchCallbackFor,
} from './core/MvvmType';

// ──────────── 事件代理 ────────────
export { ComponentProxy } from './core/ComponentProxy';
