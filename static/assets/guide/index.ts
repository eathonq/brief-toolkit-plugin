/**
 * index.ts - Guide模块入口
 * @description 该模块提供引导系统相关的组件和功能，帮助开发者实现游戏内的引导流程。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-16
 * @modified 2024-08-16
 */

export * from './core/IGuideManager';
export { GuideManager } from './components/GuideManager';
export { Guider } from './core/Guider';