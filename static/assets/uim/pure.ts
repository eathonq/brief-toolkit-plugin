/**
 * pure.ts - UIM 纯 TS 入口（零 Cocos 依赖）
 * @description 可用于 ViewModel、单元测试、Node.js 脚本等非 Cocos 运行时环境。
 *              所有导出模块及其传递依赖均不包含 `from 'cc'` 导入。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

// ──────────── 枚举 & 常量 ────────────
export {
  ViewEvent,
  ViewState,
  ViewType,
  ViewSortIndex,
  MessageBoxButtons,
  MessageBoxResult,
} from './core/IViewManager';
export type { IViewManager, MessageBoxData, TooltipData } from './core/IViewManager';

// ──────────── 静态门面（ViewModel 中直接调用）────────────
export { Views } from './core/Views';
export { MessageBox } from './core/MessageBox';
export { Tooltip } from './core/Tooltip';

// ──────────── 音频 & 皮肤 ────────────
export { Audios } from './core/Audios';
export { DefaultAudioManager } from './core/DefaultAudioManager';
export { Skins } from './core/Skins';
export { DefaultSkinManager } from './core/DefaultSkinManager';
export type {
  SkinItemDef,
  SkinItemState,
  SkinItem,
  SkinThemeConfig,
  SkinThemeState,
  ThemeDef,
} from './core/ISkinManager';

// ──────────── 场景管理 ────────────
export { Scenes } from './core/Scenes';
export type { SceneLifecycleHandler } from './core/Scenes';
export type { ISceneManager, SceneLifecycleData } from './core/ISceneManager';

// ──────────── 默认实现 ────────────
export { DefaultViewManager } from './core/DefaultViewManager';
export { DefaultSceneManager } from './core/DefaultSceneManager';

// ──────────── 工具 ────────────
export { EventMutex } from './core/EventMutex';
