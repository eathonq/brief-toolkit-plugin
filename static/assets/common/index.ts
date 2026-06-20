/**
 * index.ts - Common 模块入口
 * @description 提供 brief-toolkit 公共能力：统一资源加载/管理、资源作用域生命周期管理。
 *
 * @author eathonq
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-06-19
 */

// ──────────── 底层资源加载器 ────────────
export type { SpriteLoadFormate } from './core/CCAssets';

// ──────────── 资源作用域管理 ────────────
export { AssetScope } from './core/AssetScope';
export { AssetScopeManager } from './core/AssetScopeManager';

// ──────────── Cocos Component（挂载到场景节点）────────────
export { AssetScopeMount } from './components/AssetScopeMount';
