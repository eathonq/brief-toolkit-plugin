/**
 * index.ts - UIM 模块入口
 * @description 该文件提供 UIM（User Interface Management）管理相关的导出，包括视图管理、音频管理和皮肤管理。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2024-08-12
 * @modified 2026-06-10
 */

// ──────────── Cocos Component（挂载到场景节点）────────────
export { ViewNavigator } from './components/ViewNavigator';
export { AudioManager } from './core/AudioManager';
export { AudioSetting } from './components/AudioSetting';
export { SkinManager } from './core/SkinManager';
export { SkinSetting } from './components/SkinSetting';

// ──────────── 场景管理器（普通类，非 Component，应用启动时 init()）────────────
export { SceneManager } from './core/SceneManager';

// ──────────── 纯 TS API（ViewModel 可用，零 Cocos 依赖）────────────
export * from './pure';
