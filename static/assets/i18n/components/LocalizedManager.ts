/**
 * LocalizedManager.ts - 多语言管理绑定组件
 * @description 该组件实现了多语言切换的功能，支持在编辑器模式下修改默认语言资源和资源路径。
 * @important 在 Cocos Creator 中，通常挂载在场景根节点或常驻节点（如Canvas、RootNode）上。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-15
 * @modified 2026-03-15
 */

import { _decorator, Component, Enum, JsonAsset } from 'cc';
import { EDITOR } from 'cc/env';
import { LocalizedRenderer } from '../core/LocalizedRenderer';
import { LocalizedLabelMode } from '../core/ILocalizedRenderer';
import { I18n } from '../core/I18n';
const { ccclass, property, executeInEditMode, menu } = _decorator;

const I18N_ASSET_PATH = "i18n";

/**
 * [i18n-LocalizedManager]
 * i18n 多语言切换组件
 * EDITOR 模式下，修改 defaultAsset 和 assetPath 会直接影响 I18nRenderer 的对应属性。
 */
@ccclass('i18n.LocalizedManager')
@executeInEditMode
@menu('BriefToolkit/I18n/LocalizedManager')
export class LocalizedManager extends Component {
  // 默认语言资源
  @property(JsonAsset)
  private _defaultAsset: JsonAsset = null;
  @property({
    type: JsonAsset,
    tooltip: "默认语言配置文件",
  })
  get defaultAsset() {
    return this._defaultAsset;
  }
  set defaultAsset(value) {
    this._defaultAsset = value;
    if (EDITOR) {
      LocalizedRenderer.instance.languageAsset = value;
    }
  }

  //#region LabelModel
  @property
  private _labelModel: LocalizedLabelMode = LocalizedLabelMode.DATA;
  @property({
    type: Enum(LocalizedLabelMode),
    tooltip: "本地化文本显示模式（仅编辑状态有效）",
  })
  get labelModel() {
    return this._labelModel;
  }
  private set labelModel(value) {
    this._labelModel = value;
    LocalizedRenderer.instance.labelModel = this._labelModel;
  }
  //#endregion

  @property
  private _assetPath = I18N_ASSET_PATH;
  @property({
    tooltip: "多语言资源路径",
  })
  get assetPath() {
    return this._assetPath;
  }
  set assetPath(value: string) {
    if (EDITOR) {
      LocalizedRenderer.instance.assetPath = value;
    }
  }

  protected onLoad(): void {
    I18n.bind(LocalizedRenderer.instance);

    if (this._defaultAsset) {
      LocalizedRenderer.instance.languageAsset = this._defaultAsset;
    } else {
      console.warn("LocalizedManager: defaultAsset is not set.");
    }
  }

  protected onEnable(): void {
    I18n.bind(LocalizedRenderer.instance);
  }

  protected onDisable(): void {
    I18n.unbind(LocalizedRenderer.instance);
  }

  /**
   * 切换语言 (用于编辑器事件绑定)
   * @param object 
   * @param language 
   * @returns 
   */
  private handleSwitchLanguage(object: any, language: string): Promise<void> {
    return LocalizedRenderer.instance.switch(language);
  }
}
