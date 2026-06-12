/**
 * LocalizedSprite.ts - 本地化图片绑定组件
 * @description 该组件实现了本地化图片的功能，支持Sprite组件。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/i18n/localizedsprite}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.1.0
 *
 * @created 2026-03-15
 * @modified 2026-06-10
 */

import { _decorator, Component, Sprite, SpriteFrame } from "cc";
import { EDITOR } from "cc/env";
import { CCResources } from "../core/CCResources";
import { LocalizedManager } from "../core/LocalizedManager";
import { I18nEventType } from "../core/I18nEvent";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/**
 * [i18n-LocalizedSprite]
 * i18n 本地化图片(支持Sprite)
 */
@ccclass('i18n.LocalizedSprite')
@help('https://vangagh.gitbook.io/brief-toolkit/i18n/localizedsprite')
@executeInEditMode
@menu('BriefToolkit/I18n/LocalizedSprite')
export class LocalizedSprite extends Component {

  // 用于防止异步加载回调覆盖最新语言对应的图片
  private _resetVersion: number = 0;

  @property({
    tooltip: '绑定组件的名字',
    displayName: 'Component',
    readonly: true,
    serializable: false,
  })
  private componentName: string = Sprite.name;

  @property({
    tooltip: '组件上需要监听的属性',
    displayName: 'Property',
    readonly: true,
    serializable: false,
  })
  private componentProperty: string = "spriteFrame";

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

  //#region EDITOR

  onRestore() {
    this.checkEditorComponent();
  }

  private checkEditorComponent() {
    if (EDITOR) {
      let com = this.node.getComponent(Sprite);
      if (!com) {
        console.warn('I18nSprite 组件必须挂载在 Sprite 组件上');
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
    LocalizedManager.instance.on(I18nEventType.LANGUAGE_SWITCHED, this._onLanguageSwitched, this);
    this.resetValue();
  }

  protected onDestroy() {
    if (EDITOR) return;
    LocalizedManager.instance.off(I18nEventType.LANGUAGE_SWITCHED, this._onLanguageSwitched, this);
  }

  private _onLanguageSwitched(): void {
    this.resetValue();
  }

  /** 重置值（I18nManager 使用） */
  resetValue(): void {
    const requestVersion = ++this._resetVersion;
    const key = this._key;
    const imagePath = LocalizedManager.instance.image(key);

    // 编辑器模式下直接使用 LocalizedManager 的接口加载资源，以支持本地化预览功能
    if (EDITOR) {
      LocalizedManager.instance.resolveSpriteInEditor(imagePath).then((spriteFrame) => {
        this.setComponentValue(spriteFrame);
      });
      return;
    }

    CCResources.getSpriteFrame(imagePath).then((spriteFrame) => {
      if (requestVersion !== this._resetVersion) return;
      this.setComponentValue(spriteFrame);
    });
  }

  private setComponentValue(spriteFrame: SpriteFrame) {
    if (!spriteFrame) return;
    const sprite = this.node.getComponent(Sprite);
    if (sprite) {
      sprite.spriteFrame = spriteFrame;
    }
  }
}
