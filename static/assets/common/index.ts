/**
 * index.ts - Common 模块入口
 * @description 提供 brief-toolkit 公共能力：统一资源加载/管理、资源作用域生命周期管理、
 *              通用 HTTP/HTTPS 网络请求（基于 XMLHttpRequest，全平台可用）。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-19
 * @modified 2026-06-30
 */

// ──────────── 底层资源加载器 ────────────
export type { SpriteLoadFormate } from './core/CCAssets';

// ──────────── 资源作用域管理 ────────────
export { AssetScope } from './core/AssetScope';
export { AssetScopeManager } from './core/AssetScopeManager';

// ──────────── Cocos Component（挂载到场景节点）────────────
export { AssetScopeMount } from './components/AssetScopeMount';

// ──────────── 纯 TS API（ViewModel 可用，零 Cocos 依赖）────────────
// 包含：EventBus 事件总线、HttpClient 网络请求、HttpTemplate 类型安全 API、
//       TokenManager Token 管理、WebSocketClient WebSocket 客户端
export * from './pure';
