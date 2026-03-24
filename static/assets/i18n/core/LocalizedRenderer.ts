/**
 * LocalizedRenderer.ts - 本地化渲染器
 * @description 该类实现了本地化渲染器的核心功能，包括语言切换和文本获取等。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-15
 * @modified 2026-03-15
 */

import { assetManager, director, ImageAsset, JsonAsset, Node, SpriteFrame, Texture2D } from "cc";
import { EDITOR } from "cc/env";
import { ILocalizedRenderer, LocalizedLabelMode } from "./ILocalizedRenderer";
import { LocalizedLabel } from "../components/LocalizedLabel";
import { CCResources } from "./CCResources";
import { LocalizedSprite } from "../components/LocalizedSprite";
import { getI18nEditorSpriteUuidResolver } from "./I18nEditorBridge";

const I18N_ASSET_PATH = "i18n";

type LanguageMeta = {
  code: string;
  name: string;
  version?: string;
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
 * 本地化渲染器
 */
export class LocalizedRenderer implements ILocalizedRenderer {
  //#region  单例
  private static _instance: LocalizedRenderer | null = null;
  static get instance() {
    if (!this._instance) {
      this._instance = new LocalizedRenderer();
    }
    return this._instance;
  }
  private constructor() {
    // 私有构造函数，防止外部实例化
  }
  //#endregion

  private _assetPath = I18N_ASSET_PATH;
  private _languageAsset: JsonAsset | null = null;
  private _languageMeta: LanguageMeta | null = null;
  private _languageMap: Map<string, string> = new Map<string, string>();

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

  private _labelModel: LocalizedLabelMode = LocalizedLabelMode.DATA;
  get labelModel() {
    return this._labelModel;
  }
  set labelModel(value) {
    if (!EDITOR) {
      console.warn("labelModel can only be set in EDITOR mode. Runtime changes are not supported.");
      return;
    }
    this._labelModel = value;
    this.updateRenderers();
   }

  /** 扁平化多语言数据（提高查找性能） */
  private flattenData(data: Record<string, any>, prefix = ''): void {
    const result = this._languageMap;
    for (const [key, value] of (Object as any).entries(data)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        result.set(newKey, value);
      } else if (value && typeof value === 'object') {
        this.flattenData(value, newKey);
      }
    }
  }

  /** 更新渲染器（刷新语言） */
  private updateRenderers() {
    const scene = director.getScene();
    if (!scene) return;

    const nodes = scene.children;

    const allLabels: LocalizedLabel[] = [];
    for (const node of nodes) {
      const labels = node.getComponentsInChildren(LocalizedLabel);
      allLabels.push(...labels);
    }
    for (const label of allLabels) {
      if (!label.node.active) continue;
      label.resetValue();
    }

    const allSprites: LocalizedSprite[] = [];
    for (const node of nodes) {
      const sprites = node.getComponentsInChildren(LocalizedSprite);
      allSprites.push(...sprites);
    }
    for (const sprite of allSprites) {
      if (!sprite.node.active) continue;
      sprite.resetValue();
    }
  }

  private resetLanguage() {
    const configData = this._languageAsset?.json;
    this._languageMeta = toLanguageMeta(configData);
    if (!this._languageMeta) {
      console.error("I18nManager: Invalid language meta in default asset.");
      return;
    }

    this._languageMap.clear();
    this.flattenData(configData);
    this.updateRenderers();
  }

  /**
   * 切换语言
   * @param language 语言代码
   */
  async switch(language: string): Promise<void> {
    if (language === this._languageMeta?.code) {
      return;
    }

    // 尝试加载新语言资源
    const languagePath = `${this._assetPath}/${language}`;
    const newAsset = await CCResources.loadJsonAsset(languagePath);
    if (!newAsset) {
      return Promise.reject(new Error(`Failed to load language file at ${languagePath}`));
    }

    // 先清理之前的资源
    if (this._languageAsset) {
      assetManager.releaseAsset(this._languageAsset);
      this._languageAsset = null;
    }
    this._languageAsset = newAsset;
    this.resetLanguage();
  }

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
  text(key: string, args?: string[]): string {
    if (!key) return "";
    if (!args || args.length === 0) {
      return this._languageMap.get(key) ?? key;
    } else {
      const mainText = this._languageMap.get(key) ?? key;
      return this.format(mainText, ...args);
    }
  }

  format(template: string, ...args: any[]): string {
    return template.replace(/{(\d+)}/g, (match, index) => {
      const argIndex = parseInt(index);
      return args[argIndex] !== undefined ? args[argIndex] : match;
    });
  }

  /**
   * 获取多语言图片路径
   * @param key 图片路径 key（支持点语法，如 "image.home"）
   * @returns 多语言图片完整路径，如果未找到则返回空字符串
   */
  image(key: string): string {
    const path = this._languageMap.get(key) ?? '';
    return `${this._assetPath}/${this._languageMeta?.code}/${path}`;
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
      console.warn("LocalizedRenderer: editor sprite resolver failed", error);
      return null;
    }
  }
}