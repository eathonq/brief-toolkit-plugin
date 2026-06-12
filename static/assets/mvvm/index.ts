/**
 * index.ts - MVVM 模块入口
 * @description 提供 MVVM（Model-View-ViewModel）相关的组件和功能，帮助开发者实现数据绑定和视图更新。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2024-08-12
 * @modified 2026-06-09
 */

// ──────────── 组件静态类 ────────────

export { ViewModelData } from './components/ViewModel';
export { BindingData } from './components/Binding';
export { DataContextData } from './components/DataContext';
export { ItemsSourceData } from './components/ItemsSource';

// ──────────── 纯 TS API（装饰器、响应式、MessageBus、BaseViewModel、ErrorBoundary、类型工具） ────────────
export * from './pure';
