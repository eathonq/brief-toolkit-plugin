/**
 * SkinResources.ts - 皮肤数据存储和管理类
 * @description 该类负责维护主题和皮肤项的定义与状态，并提供查询和修改接口。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-09-02
 * @modified 2026-03-13
 */

import { SkinItem, SkinItemState, SkinThemeConfig, SkinThemeState, ThemeDef } from "./ISkinManager";

/**
 * 皮肤数据存储和管理类，负责维护主题和皮肤项的定义与状态，并提供查询和修改接口
 * 
 * 核心数据结构：
 * - _themeMap: 主题key -> 主题信息 + 皮肤项列表（用于主题维度的查询）
 * - _keyMap: key -> 主题key -> 皮肤项（用于key维度的快速查询和激活管理）
 * 
 * 激活规则：同一个key在所有主题中只能有一个active=true
 */
export class SkinStore {
  /** 主题信息映射：主题key -> 主题信息 */
  private _themeInfoMap: Map<string, ThemeDef> = new Map();

  /** 主题索引：主题key -> 皮肤项列表 */
  private _themeMap: Map<string, SkinItem[]> = new Map();

  /** key索引：key -> (主题key -> 皮肤项) */
  private _keyMap: Map<string, Map<string, SkinItem>> = new Map();

  /** 当前激活的主题key */
  private _activeThemeKey: string = '';

  get activeThemeKey(): string {
    return this._activeThemeKey;
  }

  /** 获取当前激活的主题名称（方便显示用） */
  get activeThemeName(): string {
    const themeInfo = this._themeInfoMap.get(this._activeThemeKey);
    return themeInfo?.name || '';
  }

  // ==================== 初始化方法 ====================

  /**
   * 加载主题配置
   * 只处理静态定义，不修改任何状态
   */
  loadThemeConfig(config: SkinThemeConfig): void {
    if (!config?.themes) return;

    for (let themeConfig of config.themes) {
      const themeKey = themeConfig.theme.key;
      if (!themeKey || !themeConfig.items) continue;

      // 保存主题信息
      this._themeInfoMap.set(themeKey, { ...themeConfig.theme });

      // 获取或创建主题列表
      let themeItems = this._themeMap.get(themeKey);
      if (!themeItems) {
        themeItems = [];
        this._themeMap.set(themeKey, themeItems);
      }

      // 处理每个皮肤项定义
      for (let itemDef of themeConfig.items) {
        if (!itemDef || !itemDef.key) continue;

        const existingItem = themeItems.find(item => item.key === itemDef.key);
        if (existingItem) {
          // 更新现有项（只合并定义，不影响状态）
          Object.assign(existingItem, itemDef);
        } else {
          // 添加新项（状态初始为undefined，表示未设置）
          themeItems.push({ ...itemDef });
        }
      }
    }

    // 重建key索引（定义变化了）
    this._rebuildKeyMap();

    // 设置默认主题（如果没有激活主题）
    if (!this._activeThemeKey && config.defaultThemeKey) {
      this._activeThemeKey = config.defaultThemeKey;
    }
  }

  /**
   * 恢复主题状态
   * 直接应用状态，并在设置active时确保唯一性
   */
  restoreState(state: SkinThemeState): void {
    if (!state?.themes) return;

    // 先清除所有现有状态
    this._clearAllStates();

    // 应用新状态
    for (let themeState of state.themes) {
      const themeItems = this._themeMap.get(themeState.themeKey);
      if (!themeItems) continue; // 主题不存在，忽略

      for (let itemState of themeState.items) {
        const item = themeItems.find(item => item.key === itemState.key);
        if (!item) continue; // 皮肤项不存在，忽略

        // 直接应用状态
        if (itemState.active !== undefined) item.active = itemState.active;
        if (itemState.enable !== undefined) item.enable = itemState.enable;
        if (itemState.locked !== undefined) item.locked = itemState.locked;
      }
    }

    // 修复active唯一性（如果有冲突）
    this._fixActiveConflicts();

    // 设置当前主题
    if (state.activeThemeKey && this._themeMap.has(state.activeThemeKey)) {
      this._activeThemeKey = state.activeThemeKey;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): SkinThemeState {
    const state: SkinThemeState = {
      activeThemeKey: this._activeThemeKey,
      themes: []
    };

    this._themeMap.forEach((items, themeKey) => {
      const itemStates = items
        .filter(item => item.active !== undefined || item.enable !== undefined || item.locked !== undefined)
        .map(item => {
          const stateItem: { key: string } & SkinItemState = { key: item.key };
          if (item.active !== undefined) stateItem.active = item.active;
          if (item.enable !== undefined) stateItem.enable = item.enable;
          if (item.locked !== undefined) stateItem.locked = item.locked;
          return stateItem;
        });

      if (itemStates.length > 0) {
        state.themes.push({
          themeKey: themeKey,
          items: itemStates
        });
      }
    });

    return state;
  }

  // ==================== 私有方法 ====================

  /** 重建key索引 */
  private _rebuildKeyMap(): void {
    this._keyMap.clear();

    this._themeMap.forEach((items, themeKey) => {
      items.forEach(item => {
        if (!this._keyMap.has(item.key)) {
          this._keyMap.set(item.key, new Map());
        }
        this._keyMap.get(item.key).set(themeKey, item);
      });
    });
  }

  /** 清除所有状态 */
  private _clearAllStates(): void {
    this._themeMap.forEach(items => {
      items.forEach(item => {
        delete item.active;
        delete item.enable;
        delete item.locked;
      });
    });
  }

  /** 修复active冲突：确保每个key只有一个active */
  private _fixActiveConflicts(): void {
    this._keyMap.forEach((themeMap, key) => {
      const activeItems: { themeKey: string, item: SkinItem }[] = [];

      themeMap.forEach((item, themeKey) => {
        if (item.active === true) {
          activeItems.push({ themeKey, item });
        }
      });

      // 如果有多个active，只保留第一个，其他的设为false
      if (activeItems.length > 1) {
        console.warn(`SkinResources: key ${key} 存在多个active状态，已自动修复`);
        for (let i = 1; i < activeItems.length; i++) {
          activeItems[i].item.active = false;
        }
      }
    });
  }

  /** 设置active并确保唯一性 */
  private _setActiveAndEnsureUnique(key: string, targetItem: SkinItem): void {
    const themeMap = this._keyMap.get(key);
    if (themeMap) {
      // 先清除所有同key的active状态
      themeMap.forEach(item => {
        item.active = false;
      });
    }

    // 再设置目标项为active
    targetItem.active = true;
  }

  // ==================== 公共查询方法 ====================

  /** 获取所有主题信息 */
  getAllThemes(): ThemeDef[] {
    return Array.from(this._themeInfoMap.values());
  }

  /** 获取所有主题key */
  getAllThemeKeys(): string[] {
    return Array.from(this._themeMap.keys());
  }

  /** 获取主题信息 */
  getThemeInfo(themeKey: string): ThemeDef | undefined {
    return this._themeInfoMap.get(themeKey);
  }

  /** 获取主题的皮肤项列表 */
  getThemeItems(themeKey: string): SkinItem[] | undefined {
    return this._themeMap.get(themeKey);
  }

  /** 获取当前主题的皮肤项列表 */
  getCurrentThemeItems(): SkinItem[] | undefined {
    return this._themeMap.get(this._activeThemeKey);
  }

  /** 获取当前主题信息 */
  getCurrentThemeInfo(): ThemeDef | undefined {
    return this._themeInfoMap.get(this._activeThemeKey);
  }

  /** 获取指定皮肤项 */
  getSkinItem(key: string, themeKey: string = this._activeThemeKey): SkinItem | undefined {
    return this._keyMap.get(key)?.get(themeKey);
  }

  /** 获取所有包含指定key的主题key列表 */
  getThemesWithKey(key: string): string[] {
    const themeMap = this._keyMap.get(key);
    return themeMap ? Array.from(themeMap.keys()) : [];
  }

  /** 获取指定key的激活项 */
  getActiveItem(key: string): { themeKey: string, item: SkinItem } | undefined {
    const themeMap = this._keyMap.get(key);
    if (!themeMap) return undefined;

    for (let [themeKey, item] of themeMap) {
      if (item.active === true) {
        return { themeKey, item };
      }
    }
    return undefined;
  }

  /** 通过主题名称查找主题key（名称可能不唯一，返回第一个匹配的） */
  findThemeKeyByName(themeName: string): string | undefined {
    for (let [key, info] of this._themeInfoMap) {
      if (info.name === themeName) {
        return key;
      }
    }
    return undefined;
  }

  /** 切换主题（通过主题key） */
  switchTheme(themeKey: string): boolean {
    if (!this._themeMap.has(themeKey)) {
      return false;
    }
    this._activeThemeKey = themeKey;
    return true;
  }

  /** 切换主题（通过主题名称） */
  switchThemeByName(themeName: string): boolean {
    const themeKey = this.findThemeKeyByName(themeName);
    if (!themeKey) return false;
    return this.switchTheme(themeKey);
  }

  // ==================== 状态修改方法 ====================

  /** 设置激活项（自动保证唯一性） */
  setActiveItem(key: string, themeKey: string = this._activeThemeKey): boolean {
    const item = this._keyMap.get(key)?.get(themeKey);
    if (!item) return false;

    // 检查是否可用
    if (item.enable === false || item.locked === true) {
      console.warn(`SkinResources: 皮肤项 ${key} 不可用，无法设为激活`);
      return false;
    }

    // 如果已经是激活，直接返回
    if (item.active === true) return true;

    // 设置激活并保证唯一性
    this._setActiveAndEnsureUnique(key, item);
    return true;
  }

  /** 设置可用状态 */
  setItemEnable(key: string, enable: boolean, themeKey: string = this._activeThemeKey): boolean {
    const item = this._keyMap.get(key)?.get(themeKey);
    if (!item) return false;

    item.enable = enable;
    return true;
  }

  /** 设置锁定状态 */
  setItemLocked(key: string, locked: boolean, themeKey: string = this._activeThemeKey): boolean {
    const item = this._keyMap.get(key)?.get(themeKey);
    if (!item) return false;

    item.locked = locked;
    return true;
  }

  // ==================== 资源加载 ====================

  /** 获取皮肤图片路径 */
  getSpriteUrl(key: string, themeKey: string = this._activeThemeKey): string | null {
    const item = this._keyMap.get(key)?.get(themeKey);
    if (!item) return null;

    // 检查是否可用
    if (item.enable === false || item.locked === true) {
      return null;
    }

    return item.image;
  }
}