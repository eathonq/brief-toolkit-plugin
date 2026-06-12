/**
 * LocalizedSetting.ts - 多语言配置组件（可选）
 * @description 可选的编辑器便利组件，用于在场景节点上配置默认语言和资源路径。
 *              运行时也可以通过代码直接操作 LocalizedManager.instance。
 * @important LocalizedManager 已是全局单例且自举绑定 I18n，无需依赖此组件即可工作。
 *
 * @author eathonq
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-03-15
 * @modified 2026-06-10
 */

import { _decorator, Component, Enum, JsonAsset } from 'cc';
import { EDITOR } from 'cc/env';
import { LocalizedManager } from '../core/LocalizedManager';
import { LocalizedLabelMode } from '../core/ILocalizedManager';
const { ccclass, property, executeInEditMode, menu } = _decorator;

const I18N_ASSET_PATH = "i18n";

/**
 * [i18n-LocalizedSetting]
 * i18n 多语言配置组件（可选）
 * EDITOR 模式下，修改 defaultAsset 和 assetPath 会直接影响 LocalizedManager 的对应属性。
 */
@ccclass('i18n.LocalizedSetting')
@executeInEditMode
@menu('BriefToolkit/I18n/LocalizedSetting')
export class LocalizedSetting extends Component {
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
      LocalizedManager.instance.languageAsset = value;
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
    LocalizedManager.instance.labelModel = this._labelModel;
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
      LocalizedManager.instance.assetPath = value;
    }
  }

  protected onLoad(): void {
    if (this._defaultAsset) {
      LocalizedManager.instance.languageAsset = this._defaultAsset;
    } else {
      console.warn("LocalizedSetting: defaultAsset is not set.");
    }
  }

  /**
   * 编辑器绑定事件：切换语言
   * @param object 事件对象
   * @param language 自定义多语言
    */
  onLanguageSwitch(object: any, language: string) {
    LocalizedManager.instance.switch(language);
  }
}
