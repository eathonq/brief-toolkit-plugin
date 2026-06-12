/**
 * index.ts - Guide模块入口
 * @description 该模块提供引导系统相关的组件和功能，帮助开发者实现游戏内的引导流程。
 *              V2 新增：聚焦动画、多形状、样式覆盖。
 *
 * @author eathonq
 * @license MIT
 * @version v2.0.0
 *
 * @created 2024-08-16
 * @modified 2026-06-12
 */

export * from './core/IGuideManager';
export { GuideManager } from './core/GuideManager';
export { GuideFocus } from './core/GuideFocus';
export { GuideSetting } from './components/GuideSetting';
export { Guider } from './core/Guider';
export type { IGuideCompletionStorage } from './core/Guider';
export { GuideDialogBase } from './components/GuideDialogBase';
export { GuidePointerBase } from './components/GuidePointerBase';
export { GuidePosition } from './core/GuidePosition';
export type { Direction, CalcOptions, GuidePositionResult } from './core/GuidePosition';