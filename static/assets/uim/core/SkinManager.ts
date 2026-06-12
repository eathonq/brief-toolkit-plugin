/**
 * SkinManager.ts - 皮肤管理器（全局单例）
 * @description 全局皮肤管理单例，构造函数自举绑定 Skins。
 *              数据层委托给 SkinStore，刷新层通过活跃 Sprite 集合精确驱动。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2024-09-02
 * @modified 2026-06-11
 */

import { ISkinManager, SkinItem, SkinThemeConfig, SkinThemeState, ThemeDef } from './ISkinManager';
import { SkinStore } from './SkinStore';
import { SkinSprite } from '../components/SkinSprite';
import { __skinsBind } from './Skins';

/** 皮肤管理器（全局单例） */
export class SkinManager implements ISkinManager {
  //#region 单例
  private static _instance: SkinManager | null = null;
  static get instance() {
    if (!this._instance) {
      this._instance = new SkinManager();
    }
    return this._instance;
  }
  private constructor() {
    // 自举：创建即绑定到 Skins 静态门面
    __skinsBind(this);
  }
  //#endregion

  private readonly _stores: SkinStore = new SkinStore();

  /** 已注册的活跃 SkinSprite 集合，用于精确刷新，替代全场景遍历 */
  private static readonly _activeSprites: Set<SkinSprite> = new Set();

  /** @internal 由 SkinSprite.onLoad 调用，注册到刷新表 */
  static _registerSprite(sprite: SkinSprite): void {
    SkinManager._activeSprites.add(sprite);
  }

  /** @internal 由 SkinSprite.onDestroy 调用，从刷新表注销 */
  static _unregisterSprite(sprite: SkinSprite): void {
    SkinManager._activeSprites.delete(sprite);
  }

  // ── 初始化 ──

  /** 加载主题配置（由 SkinSetting.onLoad 调用） */
  loadConfig(config: SkinThemeConfig): void {
    this._stores.loadThemeConfig(config);
  }

  // ── 委托 SkinStore ──

  restoreState(state: SkinThemeState): void {
    this._stores.restoreState(state);
    this.updateSceneRenderers();
  }

  getState(): SkinThemeState {
    return this._stores.getState();
  }

  getAllThemes(): ThemeDef[] {
    return this._stores.getAllThemes();
  }

  getThemeItems(themeKey: string): SkinItem[] {
    return this._stores.getThemeItems(themeKey);
  }

  switchTheme(themeKey: string): void {
    this._stores.switchTheme(themeKey);
    this.updateSceneRenderers();
  }

  setActiveItem(key: string, themeKey?: string): boolean {
    const updated = this._stores.setActiveItem(key, themeKey);
    if (updated) this.updateSceneRenderers();
    return updated;
  }

  setItemEnable(key: string, enable: boolean, themeKey?: string): boolean {
    const updated = this._stores.setItemEnable(key, enable, themeKey);
    if (updated) this.updateSceneRenderers();
    return updated;
  }

  setItemLocked(key: string, locked: boolean, themeKey?: string): boolean {
    const updated = this._stores.setItemLocked(key, locked, themeKey);
    if (updated) this.updateSceneRenderers();
    return updated;
  }

  getSpriteUrl(key: string, themeKey?: string): string | null {
    return this._stores.getSpriteUrl(key, themeKey);
  }

  // ── 刷新 ──

  /** 更新场景渲染器：遍历注册表中的活跃 SkinSprite，O(活跃数) 替代全场景 O(n) 遍历 */
  private updateSceneRenderers(): void {
    for (const sprite of SkinManager._activeSprites) {
      if (!sprite.node?.active) continue;
      sprite.resetValue();
    }
  }
}
