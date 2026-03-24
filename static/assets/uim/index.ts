/**
 * index.ts - UIM模块入口
 * @description 该文件提供UIM（User Interface Management）管理相关的导出，包括视图管理、音频管理和皮肤管理。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-12
 * @modified 2026-03-13
 */

export { ViewEvent, ViewState, ViewType, MessageBoxButtons, MessageBoxResult } from './core/IViewManager';
export type { MessageBoxData, TooltipData } from './core/IViewManager';
export { ViewManager } from './components/ViewManager';
export { Views } from './core/Views';
export { MessageBox } from './core/MessageBox';
export { Tooltip } from './core/Tooltip';

export { AudioManager } from './components/AudioManager';
export { Audios } from './core/Audios';

export type { SkinItemDef, SkinItemState, SkinItem, SkinThemeConfig, SkinThemeState, ThemeDef } from './core/ISkinManager';
export { SkinManager } from './components/SkinManager';
export { Skins } from './core/Skins';

export { CCResources as Resources } from './core/CCResources';
