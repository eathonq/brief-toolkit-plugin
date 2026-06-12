/**
 * SceneManager.ts — 场景管理器（普通类，非 Component）
 * @description 实现 ISceneManager，封装 director.loadScene / preloadScene，
 *              调度 Scenes.onBeforeLeave / onAfterEnter 生命周期钩子。
 *              通过 SceneManager.init() 在应用启动时初始化一次即可，无需挂载节点。
 *
 * @important 调用 director，不属于 pure.ts（有 from 'cc' 依赖）。
 *            和 ViewNavigator 不同：ViewNavigator 需要节点管理子视图，SceneManager 只用全局 director。
 *
 * @usage
 * // boot.ts 或应用入口
 * import { SceneManager } from '../brief-toolkit/uim';
 * SceneManager.init();
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-11
 */

import { director } from 'cc';
import { ISceneManager, SceneLifecycleData } from './ISceneManager';
import { Scenes, __scenesBind } from './Scenes';

export class SceneManager implements ISceneManager {
  private static _instance: SceneManager | null = null;

  /** 初始化场景管理器（应用启动时调用一次，内部自动 bind 到 Scenes） */
  static init(): SceneManager {
    if (!SceneManager._instance) {
      SceneManager._instance = new SceneManager();
      __scenesBind(SceneManager._instance);
    }
    return SceneManager._instance;
  }

  private constructor() {} // 禁止外部 new，统一走 init()

  // ── ISceneManager 实现 ──

  async loadScene(name: string, data?: any): Promise<void> {
    const fromScene = director.getScene()?.name ?? '';
    const info: SceneLifecycleData = { fromScene, toScene: name, data };

    // 依次执行离开钩子
    for (const handler of Scenes.onBeforeLeave) {
      await handler(info);
    }

    return new Promise<void>((resolve, reject) => {
      director.loadScene(name, (err) => {
        if (err) {
          reject(err);
          return;
        }
        // 场景加载完成后依次执行进入钩子
        this._runAfterEnter(info).then(resolve).catch(reject);
      });
    });
  }

  async preloadScene(name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      director.preloadScene(name, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getCurrentSceneName(): string {
    return director.getScene()?.name ?? '';
  }

  // ── private ──

  private async _runAfterEnter(info: SceneLifecycleData): Promise<void> {
    for (const handler of Scenes.onAfterEnter) {
      await handler(info);
    }
  }
}
