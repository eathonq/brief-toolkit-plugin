/**
 * index.ts - 国际化模块入口
 * @description 该模块提供国际化（i18n）相关的组件和功能，帮助开发者实现多语言支持和本地化。
 *
 * @author eathonq
 * @license MIT
 * @version v1.1.0
 *
 * @created 2024-08-16
 * @modified 2026-06-10（重构完成：事件驱动 + fallback + 纯 TS 隔离）
 *
 * @note ViewModel 中请使用 pure.ts 入口，该入口零 Cocos 依赖、永不崩溃。
 */

// 组件
export { I18nManager } from "./core/I18nManager";
export { I18nSetting } from "./components/I18nSetting";
export { I18nLabel } from "./components/I18nLabel";
export { I18nSprite } from "./components/I18nSprite";

// 枚举
export { I18nLabelMode } from "./core/II18nManager";
export { I18nEventType } from "./core/I18nEvent";

// 事件载荷类型
export type {
  I18nLanguageBeforeSwitchEvent,
  I18nLanguageSwitchedEvent,
  I18nLanguageSwitchErrorEvent,
} from "./core/I18nEvent";

// 工具
export { DateFormatter } from "./core/DateFormatter";

// 数据类型
export type { LanguageMeta } from "./core/I18nManager";

// 静态门面
export { I18n } from "./core/I18n";