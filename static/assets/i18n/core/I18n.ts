/**
 * I18n.ts - 国际化模块静态类
 * @description 该类提供全局访问接口,便捷调用切换语言、获取多语言文本等方法，依赖于 ILocalizedRenderer 的 switch 和 text 方法实现具体功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/i18n/i18n}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-15
 * @modified 2026-03-15
 */

import { ILocalizedRenderer } from "./ILocalizedRenderer";

/** i18n 静态类 */
export class I18n {
  private static _currentI18nRenderer?: ILocalizedRenderer;
  static bind(localizedManager: ILocalizedRenderer): void {
    I18n._currentI18nRenderer = localizedManager;
  }
  static unbind(localizedManager: ILocalizedRenderer): void {
    if (I18n._currentI18nRenderer === localizedManager) {
      I18n._currentI18nRenderer = undefined;
    }
  }
  private static checkCurrentI18nRenderer(): boolean {
    if (!I18n._currentI18nRenderer) {
      console.warn("I18n: currentI18nRenderer is not set.");
      return false;
    }
    return true;
  }

  static get language() {
    if (!I18n.checkCurrentI18nRenderer()) return "";
    return I18n._currentI18nRenderer!.language;
  }

  static switch(language: string): Promise<void> {
    if (!I18n.checkCurrentI18nRenderer()) return Promise.reject(new Error("currentI18nRenderer is not set."));
    return I18n._currentI18nRenderer!.switch(language);
  }

  static text(key: string, args?: string[]): string {
    if (!I18n.checkCurrentI18nRenderer()) return key;
    return I18n._currentI18nRenderer!.text(key, args);
  }
}
