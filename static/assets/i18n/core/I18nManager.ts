/**
 * I18nManager.ts - 本地化管理器（全局单例）
 * @description 该类实现了本地化管理器的全部核心功能：语言加载、切换、回退、事件、格式化。
 *              构造函数中自动调用 __i18nBind(this)，无需外部组件激活。
 *
 * @author eathonq
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-03-15
 * @modified 2026-06-11
 */

import { assetManager, ImageAsset, JsonAsset, SpriteFrame, Texture2D } from "cc";
import { EDITOR } from "cc/env";
import { II18nManager, I18nLabelMode } from "./II18nManager";
import { CCResources } from "./CCResources";
import { getI18nEditorSpriteUuidResolver } from "./I18nEditorBridge";
import { I18nEventType } from "./I18nEvent";
import { DateFormatter } from "./DateFormatter";
import { __i18nBind } from "./I18n";

const I18N_ASSET_PATH = "i18n";

export type LanguageMeta = {
  code: string;
  name: string;
  version?: string;
  /** 日期格式模板（如 "yyyy年MM月dd日"），Date 参数且时间部分为 0 时使用 */
  dateFormat?: string;
  /** 时间格式模板（如 "HH:mm:ss"），预留 */
  timeFormat?: string;
  /** 日期时间格式模板（如 "yyyy年MM月dd日 HH:mm:ss"），Date 参数且时间部分非 0 时使用 */
  dateTimeFormat?: string;
};
function toLanguageMeta(obj: any): LanguageMeta | null {
  const isTrue = obj && typeof obj.meta.code === 'string' && typeof obj.meta.name === 'string';
  if (isTrue) {
    return {
      code: obj.meta.code,
      name: obj.meta.name,
      version: typeof obj.meta.version === 'string' ? obj.meta.version : undefined,
    }
  } else {
    return null;
  }
}

/**
 * 本地化管理器（全局单例）
 */
export class I18nManager implements II18nManager {
  //#region  单例
  private static _instance: I18nManager | null = null;
  static get instance() {
    if (!this._instance) {
      this._instance = new I18nManager();
    }
    return this._instance;
  }
  private constructor() {
    __i18nBind(this);
  }
  //#endregion

  private _listeners = new Map<I18nEventType, Set<(...args: any[]) => void>>();
  private _assetPath = I18N_ASSET_PATH;
  private _languageAsset: JsonAsset | null = null;
  private _languageMeta: LanguageMeta | null = null;
  private _languageMap: Map<string, string> = new Map<string, string>();

  //#region 状态与回退
  private _isSwitching = false;
  private _fallbackLanguage: string | null = null;
  private _fallbackMap: Map<string, string> = new Map();

  /** 是否正在切换语言（可用于 UI 展示 loading 状态） */
  get isSwitching(): boolean {
    return this._isSwitching;
  }

  /** 当前回退语言代码（未设置时返回 null） */
  get fallbackLanguage(): string | null {
    return this._fallbackLanguage;
  }

  /**
   * 设置回退语言
   * 当 key 在当前语言中找不到时，会回退到该语言的翻译
   * @param language 语言代码（如 "zh"）
   */
  async setFallbackLanguage(language: string): Promise<void> {
    if (this._fallbackLanguage === language) return;

    const languagePath = `${this._assetPath}/${language}`;
    const asset = await CCResources.loadJsonAsset(languagePath);
    if (!asset) {
      console.warn(`I18nManager: Failed to load fallback language at ${languagePath}`);
      return;
    }

    this._fallbackLanguage = language;
    this._fallbackMap.clear();
    const data = asset.json as Record<string, any>;
    if (data) {
      this.flattenData(data, '', this._fallbackMap);
    }
  }

  /** 清除回退语言 */
  clearFallbackLanguage(): void {
    this._fallbackLanguage = null;
    this._fallbackMap.clear();
  }
  //#endregion

  get assetPath() {
    return this._assetPath;
  }
  set assetPath(value) {
    if (!EDITOR) {
      console.warn("assetPath can only be set in EDITOR mode. Runtime changes are not supported.");
      return;
    }
    this._assetPath = value;
  }

  set languageAsset(asset: JsonAsset) {
    this._languageAsset = asset;
    this.resetLanguage();
  }

  get languageMeta(): LanguageMeta | null {
    return this._languageMeta;
  }

  get language(): string {
    return this._languageMeta?.code ?? "";
  }

  //#region 事件订阅

  /**
   * 订阅 i18n 事件
   * @param event 事件类型
   * @param cb 回调函数
   */
  on(event: I18nEventType, cb: (...args: any[]) => void): void {
    let cbs = this._listeners.get(event);
    if (!cbs) { cbs = new Set(); this._listeners.set(event, cbs); }
    cbs.add(cb);
  }

  /**
   * 取消订阅 i18n 事件
   * @param event 事件类型
   * @param cb 回调函数
   */
  off(event: I18nEventType, cb: (...args: any[]) => void): void {
    const cbs = this._listeners.get(event);
    if (!cbs) return;
    cbs.delete(cb);
    if (cbs.size === 0) this._listeners.delete(event);
  }

  /** 发射事件（快照遍历 + 单个回调异常隔离） */
  private _emit(event: I18nEventType, payload: unknown): void {
    const cbs = this._listeners.get(event);
    if (!cbs || cbs.size === 0) return;
    for (const cb of [...cbs]) {
      try { cb(payload); } catch (e) {
        console.error(`[I18n] 事件 "${event}" 回调异常:`, e);
      }
    }
  }

  //#endregion

  private _labelModel: I18nLabelMode = I18nLabelMode.DATA;
  get labelModel() {
    return this._labelModel;
  }
  set labelModel(value) {
    if (this._labelModel === value) return;
    this._labelModel = value;
    this._emit(I18nEventType.LANGUAGE_SWITCHED, { language: this.language });
  }

  /** 扁平化多语言数据（提高查找性能） */
  private flattenData(data: Record<string, any>, prefix = '', target?: Map<string, string>): void {
    const result = target ?? this._languageMap;
    for (const [key, value] of (Object as any).entries(data)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        result.set(newKey, value);
      } else if (value && typeof value === 'object') {
        this.flattenData(value, newKey, result);
      }
    }
  }

  /** 更新渲染器（刷新语言） */
  private resetLanguage() {
    const configData = this._languageAsset?.json;
    const languageMeta = toLanguageMeta(configData);

    if (this._languageMeta && languageMeta && this._languageMeta.code === languageMeta.code) {
      // 同语言版本切换，无需刷新渲染器
      return;
    }
    
    this._languageMeta = languageMeta;
    if (!this._languageMeta) {
      console.error("I18nManager: Invalid language meta in default asset.");
      return;
    }

    this._languageMap.clear();
    this.flattenData(configData);
    // 事件驱动刷新：替代原先 updateRenderers() 的全场景遍历
    this._emit(I18nEventType.LANGUAGE_SWITCHED, { language: this._languageMeta.code });
  }

  /**
   * 切换语言
   * @param language 语言代码
   */
  async switch(language: string): Promise<void> {
    if (language === this._languageMeta?.code) {
      return;
    }
    if (this._isSwitching) {
      throw new Error('Already switching language. Please wait for the current switch to complete.');
    }

    const from = this._languageMeta?.code ?? '';
    this._isSwitching = true;
    this._emit(I18nEventType.LANGUAGE_BEFORE_SWITCH, { from, to: language });

    // 保存旧状态用于失败回滚
    const savedAsset = this._languageAsset;
    const savedMeta = this._languageMeta;
    const savedMap = new Map(this._languageMap);

    try {
      // 尝试加载新语言资源
      const languagePath = `${this._assetPath}/${language}`;
      const newAsset = await CCResources.loadJsonAsset(languagePath);
      if (!newAsset) {
        throw new Error(`Failed to load language file at ${languagePath}`);
      }

      // 新资源加载成功，释放旧资源
      if (savedAsset) {
        assetManager.releaseAsset(savedAsset);
      }
      this._languageAsset = newAsset;
      this.resetLanguage(); // 内部发射 LANGUAGE_SWITCHED 事件
    } catch (e) {
      // 回滚到旧语言状态
      this._languageAsset = savedAsset;
      this._languageMeta = savedMeta;
      this._languageMap = savedMap;

      const error = e instanceof Error ? e : new Error(String(e));
      this._emit(I18nEventType.LANGUAGE_SWITCH_ERROR, { from, to: language, error });
      throw error;
    } finally {
      this._isSwitching = false;
    }
  }

  /**
   * 获取多语言文本（编辑器绑定专用，仅支持字符串参数）
   * @param key 多语言文本路径（支持点语法，如 "common.confirm"）
   * @param args 可选的字符串参数数组，用于替换文本中的 {0} {1} 占位符
   * @returns 多语言文本，如果未找到则返回路径本身作为 fallback
   */
  text(key: string, args?: string[]): string {
    if (!key) return "";
    const value = this._resolveValue(key);
    return args?.length ? this._formatTemplate(value, ...args) : value;
  }

  /**
   * 获取多语言文本（格式化版，ViewModel 专用，支持 Date 等复杂类型）
   * @param key 多语言文本路径（支持点语法）
   * @param args 可选的参数数组，Date 类型根据语言 meta 自动格式化
   * @returns 多语言文本，如果未找到则返回路径本身作为 fallback
   */
  format(key: string, args?: any[]): string {
    if (!key) return "";
    const value = this._resolveValue(key);
    return args?.length ? this._formatTemplate(value, ...args) : value;
  }

  /** 模板级格式化：替换 {0} {1} 占位符，Date 类型自动格式化 */
  private _formatTemplate(template: string, ...args: any[]): string {
    return template.replace(/{(\d+)}/g, (match, index) => {
      const argIndex = parseInt(index);
      const arg = args[argIndex];
      if (arg === undefined || arg === null) return match;

      if (arg instanceof Date) {
        return this._formatDate(arg);
      }

      return String(arg);
    });
  }

  /** 解析 key：当前语言 → 回退语言 → key 本身 */
  private _resolveValue(key: string): string {
    const value = this._languageMap.get(key);
    if (value !== undefined) return value;

    if (this._fallbackMap.size > 0) {
      const fallback = this._fallbackMap.get(key);
      if (fallback !== undefined) return fallback;
    }

    return key;
  }

  /** 按语言 meta 中的日期格式模板格式化 Date */
  private _formatDate(date: Date): string {
    const hasTime = date.getHours() !== 0
      || date.getMinutes() !== 0
      || date.getSeconds() !== 0
      || date.getMilliseconds() !== 0;

    const pattern = hasTime
      ? (this._languageMeta?.dateTimeFormat ?? this._languageMeta?.dateFormat ?? 'yyyy-MM-dd HH:mm:ss')
      : (this._languageMeta?.dateFormat ?? 'yyyy-MM-dd');

    return DateFormatter.format(date, pattern);
  }

  /**
   * 获取多语言图片路径
   * @param key 图片路径 key（支持点语法，如 "image.home"）
   * @returns 多语言图片完整路径，如果未找到则返回空字符串
   */
  image(key: string): string {
    // 一级：当前语言
    let path = this._languageMap.get(key);

    // 二级：回退语言
    if (path === undefined && this._fallbackMap.size > 0) {
      path = this._fallbackMap.get(key);
    }

    return `${this._assetPath}/${this._languageMeta?.code}/${path ?? ''}`;
  }

  private async loadEditorSpriteFrameByUuid(uuid: string): Promise<SpriteFrame | null> {
    if (!uuid) return null;

    return new Promise<SpriteFrame | null>((resolve) => {
      assetManager.loadAny({ uuid }, (err, asset) => {
        if (err || !asset) {
          resolve(null);
          return;
        }

        if (asset instanceof SpriteFrame) {
          resolve(asset);
          return;
        }

        if (asset instanceof ImageAsset) {
          const texture = new Texture2D();
          texture.image = asset;
          const spriteFrame = new SpriteFrame();
          spriteFrame.texture = texture;
          resolve(spriteFrame);
          return;
        }

        resolve(null);
      });
    });
  }

  /** 编辑器模式下通过扩展通道解析本地化图片 */
  async resolveSpriteInEditor(imagePath: string): Promise<SpriteFrame | null> {
    if (!EDITOR) return Promise.resolve(null);
    const uuidResolver = getI18nEditorSpriteUuidResolver();
    if (!uuidResolver) return Promise.resolve(null);

    try {
      const uuid = await uuidResolver(imagePath);
      if (!uuid) return null;
      return await this.loadEditorSpriteFrameByUuid(uuid);
    } catch (error) {
      console.warn("I18nManager: editor sprite resolver failed", error);
      return null;
    }
  }
}