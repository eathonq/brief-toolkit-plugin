/**
 * LocalizedLabel.ts - 本地化文本绑定组件
 * @description 该组件实现了本地化文本的功能，支持Label、RichText和EditBox组件。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/i18n/localizedlabel}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-15
 * @modified 2026-03-15
 */

import { _decorator, Component, Label, RichText, EditBox, CCString } from "cc";
import { EDITOR } from "cc/env";
import { LocalizedRenderer } from "../core/LocalizedRenderer";
import { LocalizedLabelMode } from "../core/ILocalizedRenderer";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/** 组件检测数组 */
const COMP_ARRAY_CHECK: { type: any, property: string }[] = [
  { type: Label, property: 'string' },
  { type: RichText, property: 'string' },
  { type: EditBox, property: 'string' }
];

/**
 * [i18n-LocalizedLabel]
 * i18n 本地化文本(支持Label,RichText,EditBox)
 */
@ccclass('i18n.LocalizedLabel')
@help('https://vangagh.gitbook.io/brief-toolkit/i18n/localizedlabel')
@executeInEditMode
@menu('BriefToolkit/I18n/LocalizedLabel')
export class LocalizedLabel extends Component {

  @property({
    tooltip: '绑定组件的名字',
    displayName: 'Component',
    readonly: true,
  })
  private componentName: string = "";

  @property({
    tooltip: '组件上关联的属性',
    displayName: 'Property',
    readonly: true,
  })
  private componentProperty: string = "";

  @property
  private _key: string = "";
  @property({
    tooltip: '多语言Key（编辑状态下修改会直接影响组件显示）',
  })
  private get key() {
    return this._key;
  }
  private set key(value) {
    this._key = value;
    this.resetValue();
  }

  // 多语言参数数组
  @property([CCString])
  private _args: string[] = [];
  @property({
    type: [CCString],
    tooltip: '多语言参数数组（编辑状态下修改会直接影响组件显示）',
  })
  private get args() {
    return this._args;
  }
  private set args(value) {
    this._args = value;
    this.resetValue();
  }

  //#region EDITOR
  onRestore() {
    this.checkEditorComponent();
  }

  private checkEditorComponent() {
    if (EDITOR) {
      for (const item of COMP_ARRAY_CHECK) {
        if (this.node.getComponent(item.type)) {
          this.componentName = item.type.name;
          this.componentProperty = item.property;
          break;
        }
      }

      if (this.componentName == "") {
        console.warn('I18nLabel 组件必须挂载在 Label,RichText,EditBox 上');
        return;
      }

    }
  }
  //#endregion

  protected onLoad() {
    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    this.resetValue();
  }

  private _language: string = "";
  protected onEnable() {
    if (EDITOR) return;

    if (this._language != LocalizedRenderer.instance.language) {
      this._language = LocalizedRenderer.instance.language;
      this.resetValue();
    }
  }

  /**
   * 重置Key
   * @param key 新的Key 
   */
  resetKey(key: string) {
    this._key = key;
    this.resetValue();
  }

  /** 重置值（I18nRenderer 使用） */
  resetValue(): void {
    const key = this._key;
    const model = LocalizedRenderer.instance.labelModel;
    switch (model) {
      case LocalizedLabelMode.DATA:
        this.setComponentValue(LocalizedRenderer.instance.text(key, this._args));
        break;
      case LocalizedLabelMode.PATH:
        this.setComponentValue(key);
        break;
    }
  }

  /** 设置组件值 */
  private setComponentValue(value: string) {
    if (!value || value == "") return;

    switch (this.componentName) {
      case Label.name:
        this.node.getComponent(Label)[this.componentProperty] = `${value}`;
        break;
      case RichText.name:
        this.node.getComponent(RichText)[this.componentProperty] = `${value}`;
        break;
      case EditBox.name:
        this.node.getComponent(EditBox)[this.componentProperty] = `${value}`;
        break;
    }
  }
}
