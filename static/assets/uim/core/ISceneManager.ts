/**
 * ISceneManager.ts — 场景管理接口
 * @description 定义场景加载、预加载和生命周期钩子的契约。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

/** 场景生命周期数据 */
export interface SceneLifecycleData {
  /** 即将离开的场景名 */
  fromScene: string;
  /** 即将进入的场景名 */
  toScene: string;
  /** loadScene 传入的自定义数据 */
  data?: any;
}

/** 场景生命周期处理器 */
export type SceneLifecycleHandler = (info: SceneLifecycleData) => Promise<void> | void;

export interface ISceneManager {
  /**
   * 加载并切换到目标场景
   * @param name 场景名称
   * @param data 传递给目标场景的自定义数据
   */
  loadScene(name: string, data?: any): Promise<void>;

  /**
   * 预加载场景（后台加载资源，不切换）
   * @param name 场景名称
   */
  preloadScene(name: string): Promise<void>;

  /** 获取当前活动场景名称 */
  getCurrentSceneName(): string;
}
