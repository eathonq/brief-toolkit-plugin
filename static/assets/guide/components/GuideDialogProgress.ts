/**
 * GuideDialogProgress.ts - 引导对话框-进度实现
 * @description GuideDialogProgress 继承 GuideDialogBase，实现 Previous/Next/Finish 导航按钮
 *              和步骤进度指示器（Info/Item 模板克隆）。
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2026-06-11
 * @modified 2026-06-12
 */

import {
  _decorator, Node, Button, Sprite, Color, instantiate,
} from 'cc';

import { GuideDialogBase } from './GuideDialogBase';
import { GuideStep } from '../core/IGuideManager';
import { Direction, GuidePositionResult } from '../core/GuidePosition';
import { Guider } from '../core/Guider';

const { ccclass, menu, property } = _decorator;

/** 当前步骤指示器颜色 */
const COLOR_CURRENT = new Color(0, 200, 0, 255);
/** 非当前步骤指示器颜色（灰白） */
const COLOR_DEFAULT = new Color(180, 180, 180, 255);

/**
 * GuideDialog 实现
 *
 * Prefab 节点结构要求：
 *   - Previous 按钮节点（Button 组件）
 *   - Next 按钮节点（Button 组件）
 *   - Finish 按钮节点（Button 组件）
 *   - Info 容器节点（Layout H，包含 Item 模板）
 *   - Info 下的 Item 模板节点（Sprite，首个子节点，隐藏作模板）
 */
@ccclass('guide.GuideDialogProgress')
@menu('BriefToolkit/Guide/GuideDialogProgress')
export class GuideDialogProgress extends GuideDialogBase {
  @property({ type: Node, tooltip: 'Previous 按钮节点' })
  private prevBtn: Node = null!;

  @property({ type: Node, tooltip: 'Next 按钮节点' })
  private nextBtn: Node = null!;

  @property({ type: Node, tooltip: 'Finish 按钮节点' })
  private finishBtn: Node = null!;

  @property({ type: Node, tooltip: 'Info 容器（Layout H，内含 Item 模板）' })
  private infoContainer: Node = null!;

  @property({ type: Node, tooltip: 'Item 模板节点（作为第 0 个指示器，其余克隆）' })
  private itemTemplate: Node = null!;

  /** 除模板外的克隆指示器节点列表 */
  private _indicatorClones: Node[] = [];

  // ── 生命周期 ──

  onLoad(): void {
    super.onLoad?.();
    this._wireButtons();
  }

  // ── 公开方法 ──

  /**
   * 显示对话框，同时重建步骤指示器。
   */
  override show(
    target: Node, step: GuideStep,
    excludeDirections?: Direction[], snap?: boolean,
    stepIndex?: number, totalSteps?: number,
  ): GuidePositionResult {
    const result = super.show(target, step, excludeDirections, snap, stepIndex, totalSteps);

    const actualStepCount = totalSteps ?? this._totalSteps;
    const needsRebuild = this._indicatorClones.length + 1 !== actualStepCount;
    if (needsRebuild) {
      this._rebuildIndicators();
    }
    this._updateIndicators();
    this._updateButtonVisibility();
    return result;
  }

  hide(): void {
    super.hide();
    this._clearIndicatorClones();
  }

  // ── 按钮事件 ──

  private _wireButtons(): void {
    this.prevBtn?.on(Button.EventType.CLICK, this._onPrev, this);
    this.nextBtn?.on(Button.EventType.CLICK, this._onNext, this);
    this.finishBtn?.on(Button.EventType.CLICK, this._onFinish, this);
  }

  private _onPrev(): void {
    Guider.previousStep();
  }

  private _onNext(): void {
    Guider.nextStep();
  }

  private _onFinish(): void {
    Guider.stopTask();
  }

  // ── 按钮可见性 ──

  private _updateButtonVisibility(): void {
    const isFirst = this._stepIndex <= 0;
    const isLast = this._stepIndex >= this._totalSteps - 1;

    if (this.prevBtn) this.prevBtn.active = !isFirst;
    if (this.nextBtn) this.nextBtn.active = !isLast;
    if (this.finishBtn) this.finishBtn.active = isLast;
  }

  // ── 步骤指示器 ──

  /** 根据 _totalSteps 克隆 Item（template 本身作为索引 0） */
  private _rebuildIndicators(): void {
    this._clearIndicatorClones();

    if (!this.infoContainer || !this.itemTemplate || this._totalSteps <= 0) return;

    // 模板作为第 0 个指示器：先清理旧监听再重新绑定
    this.itemTemplate.off(Node.EventType.TOUCH_END);
    this.itemTemplate.active = true;
    this.itemTemplate.on(Node.EventType.TOUCH_END, () => {
      if (0 !== this._stepIndex) Guider.jumpTo(0);
    });

    // 克隆剩余的 1 到 totalSteps-1
    for (let i = 1; i < this._totalSteps; i++) {
      const clone = instantiate(this.itemTemplate);
      clone.active = true;
      clone.parent = this.infoContainer;
      clone.setSiblingIndex(i); // 保持顺序
      clone.on(Node.EventType.TOUCH_END, () => {
        if (i !== this._stepIndex) Guider.jumpTo(i);
      });
      this._indicatorClones.push(clone);
    }
  }

  /** 更新指示器颜色：当前步骤绿色，其他默认 */
  private _updateIndicators(): void {
    // 模板
    if (this.itemTemplate) {
      const sprite = this.itemTemplate.getComponent(Sprite);
      if (sprite) {
        sprite.color = (0 === this._stepIndex) ? COLOR_CURRENT : COLOR_DEFAULT;
      }
    }
    // 克隆
    for (let i = 0; i < this._indicatorClones.length; i++) {
      const sprite = this._indicatorClones[i].getComponent(Sprite);
      if (sprite) {
        sprite.color = (i + 1 === this._stepIndex) ? COLOR_CURRENT : COLOR_DEFAULT;
      }
    }
  }

  /** 清除所有克隆的指示器（模板不动，仅解绑事件） */
  private _clearIndicatorClones(): void {
    // 解绑模板点击事件
    if (this.itemTemplate && this.itemTemplate.isValid) {
      this.itemTemplate?.off(Node.EventType.TOUCH_END);
    }

    for (const node of this._indicatorClones) {
      if (node && node.isValid) {
        node.off(Node.EventType.TOUCH_END);
        node.removeFromParent();
        node.destroy();
      }
    }
    this._indicatorClones.length = 0;
  }

  // ── 销毁 ──

  onDestroy(): void {
    if (this.prevBtn && this.prevBtn.isValid) {
      this.prevBtn.off(Button.EventType.CLICK, this._onPrev, this);
    }
    if (this.nextBtn && this.nextBtn.isValid) {
      this.nextBtn.off(Button.EventType.CLICK, this._onNext, this);
    }
    if (this.finishBtn && this.finishBtn.isValid) {
      this.finishBtn.off(Button.EventType.CLICK, this._onFinish, this);
    }
    this._clearIndicatorClones();
  }
}
