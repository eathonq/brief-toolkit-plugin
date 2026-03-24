/**
 * SkinManager.ts - 皮肤管理绑定组件
 * @description 该组件实现了皮肤管理的功能，包括主题的切换、皮肤项的激活和状态管理等。
 * @important 在 Cocos Creator 中，通常挂载在场景根节点或常驻节点（如Canvas、RootNode）上。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/skinmanager}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-09-02
 * @modified 2026-03-12
 */

import { _decorator, Component, director, JsonAsset, Node } from 'cc';
import { ISkinManager, SkinItem, SkinThemeConfig, SkinThemeState, ThemeDef } from '../core/ISkinManager';
import { SkinStore } from '../core/SkinStore';
import { SkinSprite } from './SkinSprite';
import { Skins } from '../core/Skins';

const { ccclass, help, menu, property } = _decorator;

/**
 * 皮肤管理绑定组件
 */
@ccclass('uim.SkinManager')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/skinmanager')
@menu('BriefToolkit/UIM/SkinManager')
export class SkinManager extends Component implements ISkinManager {
  private readonly _stores: SkinStore = new SkinStore();

  @property(JsonAsset)
  private _skinItem: JsonAsset = null;
  @property({
    type: JsonAsset,
    tooltip: "皮肤 JSON 配置",
  })
  get skinItem() {
    return this._skinItem;
  }
  set skinItem(value) {
    this._skinItem = value;
  }

  protected onLoad(): void {
    Skins.bind(this);
    
    if (this._skinItem) {
      this._stores.loadThemeConfig(this._skinItem.json as SkinThemeConfig);
    }
    // this.updateSceneRenderers();
  }

  protected onEnable(): void {
    Skins.bind(this);
  }

  protected onDisable(): void {
    Skins.unbind(this);
  }

  /**
   * 恢复主题状态
   * 直接应用状态，并在设置active时确保唯一性
   */
  restoreState(state: SkinThemeState): void {
    this._stores.restoreState(state);
    this.updateSceneRenderers();
  }

  /**
   * 获取当前状态
   */
  getState(): SkinThemeState {
    return this._stores.getState();
  }

  /**
   * 获取所有主题
   * @returns 
   */
  getAllThemes(): ThemeDef[] {
    return this._stores.getAllThemes();
  }

  /**
   * 获取主题的皮肤项列表
   * @param themeKey 
   * @returns 
   */
  getThemeItems(themeKey: string): SkinItem[] {
    return this._stores.getThemeItems(themeKey);
  }

  /**
   * 切换主题
   * @param themeKey 
   */
  switchTheme(themeKey: string): void {
    this._stores.switchTheme(themeKey);
    this.updateSceneRenderers();
  }

  /**
   * 当前主题下设置激活项
   * @param key
   * @param themeKey 可选的主题key，默认为当前主题
   * @return 是否成功设置（成功设置会更新渲染器）
   */
  setActiveItem(key: string, themeKey?: string): boolean {
    const updated = this._stores.setActiveItem(key, themeKey);
    if (updated) {
      this.updateSceneRenderers();
    }
    return updated;
  }

  /**
   * 当前主题下设置可用状态
   * @param key
   * @param enable
   * @param themeKey 可选的主题key，默认为当前主题
   * @return 是否成功设置（成功设置会更新渲染器）
   */
  setItemEnable(key: string, enable: boolean, themeKey?: string): boolean {
    const updated = this._stores.setItemEnable(key, enable, themeKey);
    if (updated) {
      this.updateSceneRenderers();
    }
    return updated;
  }

  /**
   * 当前主题下设置锁定状态
   * @param key
   * @param locked
   * @param themeKey 可选的主题key，默认为当前主题
   * @return 是否成功设置（成功设置会更新渲染器）
   */
  setItemLocked(key: string, locked: boolean, themeKey?: string): boolean {
    const updated = this._stores.setItemLocked(key, locked, themeKey);
    if (updated) {
      this.updateSceneRenderers();
    }
    return updated;
  }


  /**
   * 获取当前主题下的皮肤图片路径
   * @param key
   * @param themeKey 可选的主题key，默认为当前主题
   * @return 皮肤图片路径，或null如果未找到
   */
  getSpriteUrl(key: string, themeKey?: string): string | null {
    return this._stores.getSpriteUrl(key, themeKey);
  }

  /** 更新场景渲染器（刷新皮肤） */
  private updateSceneRenderers() {
    const rootNodes = director.getScene()!.children;
    // walk all nodes with localize sprite and update
    const allSprites: SkinSprite[] = [];
    for (let i = 0; i < rootNodes.length; ++i) {
      let sprites = rootNodes[i].getComponentsInChildren(SkinSprite);
      allSprites.push(...sprites);
    }
    for (let i = 0; i < allSprites.length; ++i) {
      let sprite = allSprites[i];
      if (!sprite.node.active) continue;
      sprite.resetValue();
    }
  }
}

