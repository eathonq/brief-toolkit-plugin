/**
 * ISkinManager.ts - 皮肤管理接口
 * @description 该接口定义了皮肤管理的功能，包括主题切换、皮肤项状态管理等操作。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-14
 * @modified 2026-03-14
 */

/** 皮肤项定义（静态配置） */
export type SkinItemDef = {
  /** 唯一标识（同一主题内唯一） */
  key: string;
  /** 显示名称 */
  name: string;
  /** 图片路径 */
  image: string;
  /** 显示排序 */
  order?: number;
  /** 扩展参数 */
  params?: { [key: string]: any };
}

/** 皮肤项状态（动态配置） */
export type SkinItemState = {
  /** 是否为激活皮肤（同一key全局唯一） */
  active?: boolean;
  /** 是否可用（是否已获得） */
  enable?: boolean;
  /** 是否锁定中（需条件解锁） */
  locked?: boolean;
}

/** 完整皮肤项数据 */
export type SkinItem = SkinItemDef & SkinItemState;

/** 主题定义（静态） */
export type ThemeDef = {
  /** 唯一标识 */
  key: string;
  /** 显示名称 */
  name: string;
}

/** 皮肤主题配置（静态） */
export type SkinThemeConfig = {
  /** 默认主题key */
  defaultThemeKey: string;
  /** 主题列表 */
  themes: {
    /** 主题定义 */
    theme: ThemeDef;
    /** 皮肤项列表 */
    items: SkinItemDef[];
  }[];
}

/** 皮肤主题状态（动态） */
export type SkinThemeState = {
  /** 当前激活的主题key */
  activeThemeKey: string;
  /** 各主题的皮肤项状态 */
  themes: {
    /** 主题key */
    themeKey: string;
    /** 皮肤项状态列表 */
    items: ({ key: string } & SkinItemState)[];
  }[];
}

export interface ISkinManager {
  /**
   * 恢复主题状态
   * 直接应用状态，并在设置active时确保唯一性
   */
  restoreState(state: SkinThemeState): void;

  /**
   * 获取当前状态
   */
  getState(): SkinThemeState;

  /**
   * 获取所有主题
   * @returns 
   */
  getAllThemes(): ThemeDef[];

  /**
   * 获取主题的皮肤项列表
   * @param themeKey 
   * @returns 
   */
  getThemeItems(themeKey: string): SkinItem[];

  /**
  * 切换主题
  * @param themeKey 
  */
  switchTheme(themeKey: string): void;

  /**
   * 当前主题下设置激活项
   * @param key
   */
  setActiveItem(key: string): boolean;

  /**
   * 当前主题下设置可用状态
   * @param key
   * @param enable
   */
  setItemEnable(key: string, enable: boolean): boolean;

  /**
   * 当前主题下设置锁定状态
   * @param key
   * @param locked
   */
  setItemLocked(key: string, locked: boolean): boolean;

  /**
   * 获取当前主题下的皮肤图片路径
   * @param key
   */
  getSpriteUrl(key: string, themeKey?: string): string | null;
}
