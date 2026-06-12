/**
 * GuidePointerBase.ts - 引导指示器基类
 * @description GuidePointerBase 是用户自定义指示器的基类，挂载到 Prefab 根节点后拖入 GuideSetting.guidePointer。
 *              GuidePosition 提供位置计算，返回方向信息用于翻转内容节点。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-11
 */

import {
  _decorator, Component, Node, v3, tween, Enum,
  Tween,
} from 'cc';
import { IGuidePointer, GuideStep, PointerConfig } from '../core/IGuideManager';
import { GuidePosition, GuidePositionResult, Direction, CalcOptions } from '../core/GuidePosition';

const { ccclass, menu, property } = _decorator;

/** 指示器方向默认优先级：上 > 下 > 右 > 左 */
const POINTER_PRIORITY: Direction[] = ['top', 'bottom', 'right', 'left'];

/** 动画类型 */
export enum AnimType {
  /* 无动画 */
  None = 'none',
  /* 上下浮动 */
  Bounce = 'bounce',
  /* 放大缩小 */
  Pulse = 'pulse',
}

/**
 * 引导指示器基类
 *
 * 使用方式：
 *   1. 创建指示器 Prefab，根节点挂载继承自本类的自定义 Component
 *   2. 在 Prefab 下创建内容节点（手指图片等），拖入 content 栏位
 *   3. 将 Prefab 拖入 GuideSetting.guidePointer
 *
 * 基类自动根据最终方向翻转内容节点，并提供内置 bounce/pulse 动画。
 */
@ccclass('guide.GuidePointerBase')
@menu('BriefToolkit/Guide/GuidePointerBase')
export class GuidePointerBase extends Component implements IGuidePointer {

  @property({
    type: Node,
    tooltip: '翻转目标节点（可选，不填则翻转根节点本身）',
  })
  protected flipTarget: Node | null = null;

  @property({
    type: Enum(AnimType),
    tooltip: '指示器动画类型',
  })
  protected animationType: AnimType = AnimType.Bounce;

  /** 当前所在方向（子类可读取） */
  protected currentDirection: Direction | null = null;

  /**
   * 步骤间过渡动画时长（秒），默认 0.3。
   * 由 GuideSetting 在初始化时根据 focusSwitchDuration 设置。
   */
  public transitionDuration: number = 0.3;

  /**
   * 与目标节点的间距（px），默认 8。
   * 由 GuideSetting 在初始化时根据 focusMargin 设置。
   */
  public guideGap: number = 8;

  /**
   * 显示指示器
   * @param excludeDirections 排除的方向，定位时跳过
   * @param snap true 时直接定位不带动画（任务首次显示）
   * @returns 最终位置信息（position + direction）
   */
  show(target: Node, step: GuideStep, excludeDirections?: Direction[], snap?: boolean): GuidePositionResult {
    const config = (step.pointer ?? {}) as PointerConfig;
    const preferred = config.position ?? 'auto';
    let priority: Direction[] = preferred === 'auto'
      ? [...POINTER_PRIORITY]
      : [preferred as Direction, ...POINTER_PRIORITY.filter(d => d !== preferred)];
    // 排除指定方向
    if (excludeDirections?.length) {
      const filtered = priority.filter(d => excludeDirections.indexOf(d) === -1);
      if (filtered.length > 0) priority = filtered;
    }
    const ox = config.offset?.x ?? 0;
    const oy = config.offset?.y ?? 0;
    const result = this.positionAt(target, { priority, offset: { x: ox, y: oy }, gap: this.guideGap });
    this.applyDirection(result.direction);
    this.node.active = true;
    this.playAnimation(snap);
    return result;
  }

  /** 隐藏指示器 */
  hide(): void {
    this.stopAnimation();
    this.node.active = false;
  }

  /**
   * 定位指示器到目标节点旁
   * @returns 最终位置与方向
   */
  protected positionAt(target: Node, options?: CalcOptions): GuidePositionResult {
    const r = GuidePosition.calc(this.node, target, options);
    this.node.setPosition(r.position);
    this.currentDirection = r.direction;
    return r;
  }

  /**
   * 根据方向翻转节点。
   * 默认翻转 flipTarget 或根节点。
   * 子类可覆盖以实现自定义翻转逻辑。
   */
  protected applyDirection(dir: Direction): void {
    const visual = this.flipTarget || this.node;
    visual.setScale(v3(1, 1, 1));
    visual.setRotationFromEuler(0, 0, 0);
    switch (dir) {
      case 'top': break;
      case 'bottom': visual.setScale(v3(1, -1, 1)); break;
      case 'left':   visual.setRotationFromEuler(0, 0, 90); break;
      case 'right':  visual.setRotationFromEuler(0, 0, -90); break;
    }
  }

  /**
   * 播放指示器动画
   */
  protected playAnimation(snap?: boolean): void {
    if (this.animationType === AnimType.None) return;

    if(snap){
      this.stopAnimationImmediate();
    }

    const visual = this.flipTarget || this.node;

    const dur = this.transitionDuration;
    switch (this.animationType) {
      case AnimType.Bounce:
        const pos = visual.position.clone();
        tween(visual)
          .to(dur, { position: v3(pos.x, pos.y - 8, pos.z) })
          .to(dur, { position: pos })
          .union()
          .repeatForever()
          .start();
        break;
      case AnimType.Pulse:
        tween(visual)
          .to(dur, { scale: v3(1.15, 1.15, 1) })
          .to(dur, { scale: v3(1, 1, 1) })
          .union()
          .repeatForever()
          .start();
        break;
    }
  }

  /**
   * 停止动画并还原视觉状态
   */
  private stopAnimation(): void {
    const visual = this.flipTarget || this.node;
    tween(visual).stop();
    visual.setScale(v3(1, 1, 1));
  }

  /** 彻底停止动画 */
  private stopAnimationImmediate(): void {
    const visual = this.flipTarget || this.node;
    Tween.stopAllByTarget(visual);
    visual.setScale(v3(1, 1, 1));
  }
}
