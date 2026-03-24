/**
 * ILocalizedRenderer.ts - 本地化渲染接口
 * @description 该接口定义了本地化渲染器的核心功能，包括语言切换和文本获取等。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-15
 * @modified 2026-03-15
 */

/** 本地化显示模式 */
export enum LocalizedLabelMode {
  /** 解析数据 */
  DATA = 0,
  /** 路径数据 */
  PATH = 1,
}

/**
 * 本地化渲染接口
 */
export interface ILocalizedRenderer {

  /** 当前语言代码 */
  language: string;

  /**
   * 切换语言
   * @param language 语言代码
   */
  switch(language: string): Promise<void>;

  /**
   * 获取多语言文本
   * @param key 多语言文本路径（支持点语法，如 "common.confirm"）
   * @param args 可选的参数数组，用于替换文本中的占位符（如 "welcome_message": "Welcome, {0}!"）
   * @returns 多语言文本，如果未找到则返回路径本身作为 fallback
   * @example
   * // 假设当前语言数据为 { "common": { "confirm": "确定" } }
   * i18nRenderer.text("common.confirm"); // 返回 "确定"
   * i18nRenderer.text("common.cancel"); // 返回 "common.cancel"（未找到，返回 key）  
   * i18nRenderer.text("welcome"); // 返回 "welcome"（未找到，返回 key）
   */
  text(key: string, args?: string[]): string;
}