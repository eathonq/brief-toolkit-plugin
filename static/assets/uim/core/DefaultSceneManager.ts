/**
 * DefaultSceneManager.ts — ISceneManager 的默认空实现（Null Object Pattern）
 * @description 在真实 SceneManager 绑定前提供安全的空操作，确保 ViewModel 中的
 *              Scenes 调用永不因未绑定而崩溃。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

import { ISceneManager } from './ISceneManager';

export class DefaultSceneManager implements ISceneManager {
  static readonly instance = new DefaultSceneManager();

  private _log(method: string, name?: string): void {
    console.debug(`[UIM] DefaultSceneManager.${method}("${name ?? ''}") — real SceneManager not bound yet`);
  }

  async loadScene(name: string, data?: any): Promise<void> {
    this._log('loadScene', name);
  }

  async preloadScene(name: string): Promise<void> {
    this._log('preloadScene', name);
  }
}
