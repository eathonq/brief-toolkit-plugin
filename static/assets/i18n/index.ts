/**
 * index.ts - 国际化模块入口
 * @description 该模块提供国际化（i18n）相关的组件和功能，帮助开发者实现多语言支持和本地化。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-16
 * @modified 2024-09-02
 */

export { LocalizedRenderer as I18nRenderer } from "./core/LocalizedRenderer";
export { LocalizedManager as I18nSwitch } from "./components/LocalizedManager";
export { LocalizedLabel as I18nLabel } from "./components/LocalizedLabel";
export { LocalizedSprite as I18nSprite } from "./components/LocalizedSprite";

export { I18n } from "./core/I18n";