/**
 * DefaultSkinManager.ts — ISkinManager 的默认空实现（Null Object Pattern）
 * @description 在真实 SkinManager 绑定前提供安全的空操作，确保 ViewModel 中的
 *              Skins 调用永不因未绑定而崩溃。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

import { ISkinManager, SkinItem, SkinThemeState, ThemeDef } from "./ISkinManager";

export class DefaultSkinManager implements ISkinManager {
  static readonly instance = new DefaultSkinManager();

  restoreState(_state: SkinThemeState): void {}
  getState(): SkinThemeState { return { activeThemeKey: '', themes: [] }; }
  getAllThemes(): ThemeDef[] { return []; }
  getThemeItems(_themeKey: string): SkinItem[] | undefined { return []; }
  switchTheme(_themeKey: string): void {}
  setActiveItem(_key: string): boolean { return false; }
  setItemEnable(_key: string, _enable: boolean): boolean { return false; }
  setItemLocked(_key: string, _locked: boolean): boolean { return false; }
  getSpriteUrl(_key: string, _themeKey?: string): string | null { return null; }
}
