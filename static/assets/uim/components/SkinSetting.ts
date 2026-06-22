/**
 * SkinSetting.ts - 皮肤配置组件（可选）
 * @description 可选的编辑器便利组件，用于在场景节点上配置默认皮肤 JSON。
 *              SkinManager 已是全局单例且自举绑定 Skins，无需依赖此组件即可工作。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2024-09-02
 * @modified 2026-06-10
 */

import { _decorator, Component, JsonAsset } from 'cc';
import { SkinThemeConfig } from '../core/ISkinManager';
import { SkinManager } from '../core/SkinManager';
const { ccclass, help, menu, property } = _decorator;

/** 皮肤配置组件（可选） */
@ccclass('uim.SkinSetting')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/skinmanager')
@menu('BriefToolkit/UIM/SkinSetting')
export class SkinSetting extends Component {
  @property(JsonAsset)
  private _skinItem: JsonAsset = null!;
  @property({ type: JsonAsset, tooltip: "皮肤 JSON 配置" })
  get skinItem() {
    return this._skinItem;
  }
  set skinItem(value) {
    this._skinItem = value;
  }

  protected onLoad(): void {
    if (this._skinItem) {
      SkinManager.instance.loadConfig(this._skinItem.json as SkinThemeConfig);
    }
  }
}
