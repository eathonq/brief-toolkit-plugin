/**
 * Skins.ts - 皮肤管理静态类（Null Object 兜底）
 * @description 该类提供全局访问接口，自动回退到 DefaultSkinManager 确保 ViewModel 中
 *              的调用永不崩溃。所有方法代理到 ISkinManager 的具体实现。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/skins}
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-03-14
 * @modified 2026-06-11
 */

import { ISkinManager, SkinItem, SkinThemeState, ThemeDef } from "./ISkinManager";
import { DefaultSkinManager } from "./DefaultSkinManager";

/**
 * 模块级私有状态。
 * 不挂载在 Skins 类上，避免通过 pure.ts 导出暴露给外部使用者。
 */
let _currentSkinManager: ISkinManager | undefined;

/**
 * @internal 绑定真实 Manager（由 SkinManager 构造函数自动调用）
 *
 * 本函数不通过 pure.ts / index.ts 重导出，外部使用者无法访问。
 */
export function __skinsBind(manager: ISkinManager): void {
  _currentSkinManager = manager;
}

/**
 * @internal 解绑 Manager
 */
export function __skinsUnbind(manager: ISkinManager): void {
  if (_currentSkinManager === manager) {
    _currentSkinManager = undefined;
  }
}

/** 皮肤管理静态门面 */
export class Skins {
  /**
   * 获取当前 Manager。
   * 若未绑定真实 SkinManager，自动回退到 DefaultSkinManager（Null Object），
   * 确保 ViewModel 中的调用永不因未绑定而崩溃。
   */
  private static get current(): ISkinManager {
    return _currentSkinManager ?? DefaultSkinManager.instance;
  }

  static restoreState(state: SkinThemeState): void {
    Skins.current.restoreState(state);
  }

  static getState(): SkinThemeState {
    return Skins.current.getState();
  }

  static getAllThemes(): ThemeDef[] {
    return Skins.current.getAllThemes();
  }

  static getThemeItems(themeKey: string): SkinItem[] | undefined {
    return Skins.current.getThemeItems(themeKey);
  }

  static switchTheme(themeKey: string): void {
    Skins.current.switchTheme(themeKey);
  }

  static setActiveItem(key: string): boolean {
    return Skins.current.setActiveItem(key);
  }

  static setItemEnable(key: string, enable: boolean): boolean {
    return Skins.current.setItemEnable(key, enable);
  }

  static setItemLocked(key: string, locked: boolean): boolean {
    return Skins.current.setItemLocked(key, locked);
  }

  static getSpriteUrl(key: string, themeKey?: string): string | null {
    return Skins.current.getSpriteUrl(key, themeKey);
  }
}
