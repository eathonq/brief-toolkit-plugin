/**
 * SceneManager.ts — 场景管理器（普通类，非 Component）
 * @description 实现 ISceneManager，封装 director.loadScene / preloadScene。
 *              场景加载完成后通过 director.getScene().emit 向场景内组件广播，
 *              同时通过 EventBus.emit 通知框架外全局观察者。
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
import { ISceneManager, SceneEventData, SceneEvent } from './ISceneManager';
import { __scenesBind } from './Scenes';
import { EventBus } from '../../common/core/EventBus';

export class SceneManager implements ISceneManager {
  private static _instance: SceneManager = null!;

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
    const info: SceneEventData = { fromScene, toScene: name, data };

    return new Promise<void>((resolve, reject) => {
      director.loadScene(name, (err) => {
        if (err) {
          reject(err);
          return;
        }
        // node.emit → 场景内组件（节点销毁自动清理）
        // EventBus.emit → 框架外全局观察者（persist 节点 / 非 Cocos 上下文）
        const newScene = director.getScene();
        newScene?.emit(SceneEvent, info);
        EventBus.emit(SceneEvent, info);
        resolve();
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

}
