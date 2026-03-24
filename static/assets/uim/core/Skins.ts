/**
 * Skins.ts - 皮肤管理静态类
 * @description 该类提供全局访问接口，实际逻辑由当前激活的 SkinManager 组件实现。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/skins}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-14
 * @modified 2026-03-14
 */

import { ISkinManager, SkinItem, SkinThemeState, ThemeDef } from "./ISkinManager";

/** 
 * 皮肤管理静态类，提供全局访问接口，实际逻辑由当前激活的 SkinManager 组件实现
 * @help https://vangagh.gitbook.io/brief-toolkit/uim/skins
 */
export class Skins {
  private static _currentSkinManager?: ISkinManager;
  static bind(skinManager: ISkinManager): void {
    Skins._currentSkinManager = skinManager;
  }
  static unbind(skinManager: ISkinManager): void {
    if (Skins._currentSkinManager === skinManager) {
      Skins._currentSkinManager = undefined;
    }
  }
  private static checkCurrentSkinManager(): boolean {
    if (!Skins._currentSkinManager) {
      console.warn("Skins: currentSkinManager is not set.");
      return false;
    }
    return true;
  }

  /**
   * 恢复主题状态
   * 直接应用状态，并在设置active时确保唯一性
   */
  static restoreState(state: SkinThemeState): void {
    if (!Skins.checkCurrentSkinManager()) {
      return;
    }
    Skins._currentSkinManager.restoreState(state);
  }

  /**
   * 获取当前状态
   */
  static getState(): SkinThemeState {
    if (!Skins.checkCurrentSkinManager()) {
      return;
    }
    return Skins._currentSkinManager.getState();
  }

  /**
   * 获取所有主题
   * @returns 
   */
  static getAllThemes(): ThemeDef[] {
    if (!Skins.checkCurrentSkinManager()) {
      return [];
    }
    return Skins._currentSkinManager.getAllThemes();
  }

  /**
   * 获取主题的皮肤项列表
   * @param themeKey 
   * @returns 
   */
  static getThemeItems(themeKey: string): SkinItem[] {
    if (!Skins.checkCurrentSkinManager()) {
      return [];
    }
    return Skins._currentSkinManager.getThemeItems(themeKey);
  }

  /**
  * 切换主题
  * @param themeKey 
  */
  static switchTheme(themeKey: string): void {
    if (!Skins.checkCurrentSkinManager()) {
      return;
    }
    Skins._currentSkinManager.switchTheme(themeKey);
  }

  /**
   * 当前主题下设置激活项
   * @param key
   */
  static setActiveItem(key: string): boolean {
    if (!Skins.checkCurrentSkinManager()) {
      return false;
    }
    return Skins._currentSkinManager.setActiveItem(key);
  }

  /**
   * 当前主题下设置可用状态
   * @param key
   * @param enable
   */
  static setItemEnable(key: string, enable: boolean): boolean {
    if (!Skins.checkCurrentSkinManager()) {
      return false;
    }
    return Skins._currentSkinManager.setItemEnable(key, enable);
  }

  /**
   * 当前主题下设置锁定状态
   * @param key
   * @param locked
   */
  static setItemLocked(key: string, locked: boolean): boolean {
    if (!Skins.checkCurrentSkinManager()) {
      return false;
    }
    return Skins._currentSkinManager.setItemLocked(key, locked);
  }

  /**
   * 获取当前主题下的皮肤图片路径
   * @param key
   */
  static getSpriteUrl(key: string): string | null {
    if (!Skins.checkCurrentSkinManager()) {
      return null;
    }
    return Skins._currentSkinManager.getSpriteUrl(key);
  }
}