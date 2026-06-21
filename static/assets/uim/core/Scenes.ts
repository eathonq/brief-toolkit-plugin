/**
 * Scenes.ts — 场景管理静态类
 * @description 提供全局场景切换入口，ViewModel 中直接调用。
 *              场景进入事件通过 EventBus 订阅（EventBus.on(SceneEvent, ...)）。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-11
 */

import { ISceneManager } from './ISceneManager';
import { DefaultSceneManager } from './DefaultSceneManager';

/**
 * 模块级私有状态。
 * 不挂载在 Scenes 类上，避免通过 pure.ts 导出暴露给外部使用者。
 */
let _currentSceneManager: ISceneManager | undefined;

/**
 * @internal 绑定真实 SceneManager（由 SceneManager.init() 自动调用）
 *
 * 本函数不通过 pure.ts / index.ts 重导出，外部使用者无法访问。
 */
export function __scenesBind(manager: ISceneManager): void {
  _currentSceneManager = manager;
}

/**
 * @internal 解绑 SceneManager
 */
export function __scenesUnbind(manager: ISceneManager): void {
  if (_currentSceneManager === manager) {
    _currentSceneManager = undefined;
  }
}

/** 场景管理静态类 */
export class Scenes {
  /** 获取当前 ISceneManager，未绑定时自动回退 DefaultSceneManager */
  static get current(): ISceneManager {
    return _currentSceneManager ?? DefaultSceneManager.instance;
  }

  // ── API ──

  /**
   * 加载并切换到目标场景
   * @param name 场景名称
   * @param data 传递给目标场景的自定义数据
   */
  static async loadScene(name: string, data?: any): Promise<void> {
    return Scenes.current.loadScene(name, data);
  }

  /**
   * 预加载场景（后台加载资源，不切换）
   * @param name 场景名称
   */
  static async preloadScene(name: string): Promise<void> {
    return Scenes.current.preloadScene(name);
  }
}
