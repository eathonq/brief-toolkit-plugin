/**
 * SkinSprite.ts - 皮肤精灵绑定组件
 * @description 该组件用于在 Cocos Creator 中显示皮肤相关的精灵，自动根据指定的皮肤标识加载对应的 SpriteFrame。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/skinsprite}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-09-02
 * @modified 2026-03-12
 */

import { _decorator, Component, Node, Sprite } from 'cc';
import { SkinItemDef } from '../core/ISkinManager';
import { CCResources } from '../core/CCResources';
import { Skins } from '../core/Skins';

const { ccclass, help, menu, property, requireComponent } = _decorator;

/**
 * 皮肤精灵绑定组件
 */
@ccclass('uim.SkinSprite')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/skinsprite')
@requireComponent(Sprite)
@menu('BriefToolkit/UIM/SkinSprite')
export class SkinSprite extends Component {

  /**
   * 获取皮肤信息
   * @param node 
   * @returns 
   */
  static Info(node: Node): SkinItemDef {
    let skin = node.getComponent(SkinSprite);
    if (!skin) return null;
    return skin.info;
  }

  @property({
    tooltip: '皮肤标识',
  })
  key: string = "";

  private _info: SkinItemDef;
  /** 皮肤信息 */
  get info() {
    return this._info;
  }

  protected onLoad(): void {
    this.resetValue();
  }

  // 重置值
  resetValue() {
    const sprite = this.getComponent(Sprite);
    if (!sprite) return;

    const key = this.key;
    const spritePath = Skins.getSpriteUrl(key);
    if (!spritePath) {
      console.warn(`SkinSprite: No sprite path found for key "${key}"`);
      return;
    }

    CCResources.getSpriteFrame(spritePath).then((spriteFrame) => {
      if (!spriteFrame) return;
      sprite.spriteFrame = spriteFrame;
    });
  }
}
