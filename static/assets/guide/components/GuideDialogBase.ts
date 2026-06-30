/**
 * GuideDialogBase.ts - 引导对话框基类
 * @description GuideDialogBase 是用户自定义对话框的基类，挂载到 Prefab 根节点后拖入 GuideSetting.guideDialog。
 *              GuidePosition 提供位置计算，子类在 show() 中可直接调用。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-11
 * @modified 2026-06-11
 */

import { _decorator, Component, Node, Label, tween } from 'cc';
import { GuideStep, IGuideDialog } from '../core/IGuideManager';
import { GuidePosition, GuidePositionResult, Direction } from '../core/GuidePosition';

const { ccclass, menu, property } = _decorator;

/** 对话框方向默认优先级：下 > 上 > 右 > 左 */
const DIALOG_PRIORITY: Direction[] = ['bottom', 'top', 'right', 'left'];

/**
 * 引导对话框基类
 *
 * 任务级首次 show 时 snap 到位置（无过渡），步骤间切换时平滑移动。
 * hide() 时停止 tween 并标记下次为首次。
 *
 * show() 先同步返回位置信息，再通过 scheduleOnce 延迟执行定位，
 * 等待 Layout + Label 内容更新完成后再计算最终位置。
 */
@ccclass('guide.GuideDialogBase')
@menu('BriefToolkit/Guide/GuideDialogBase')
export class GuideDialogBase extends Component implements IGuideDialog {
  @property({ type: Label, tooltip: '标题 Label，show 时自动填入 step.title' })
  protected titleLabel: Label = null!;

  @property({ type: Label, tooltip: '描述 Label，show 时自动填入 step.description' })
  protected descriptionLabel: Label = null!;

  /** 当前步骤索引（子类可读取，用于进度指示器） */
  protected _stepIndex: number = -1;

  /** 总步骤数（子类可读取） */
  protected _totalSteps: number = 0;

  /** 延迟定位回调引用（用于 unschedule 取消） */
  private _deferredPosition: (() => void) | null = null;

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
   * 显示对话框
   *
   * 流程：
   *   1. 设置文本内容（同步）
   *   2. 立即返回位置信息（方向可用于 excludeDirections）
   *   3. scheduleOnce 延迟执行实际定位 + 动画，等待 Layout 更新
   *
   * @param excludeDirections 排除的方向，定位时跳过
   * @param snap true 时直接定位不带动画（任务首次显示）
   * @param stepIndex 当前步骤索引（可选，用于进度指示器）
   * @param totalSteps 总步骤数（可选）
   * @returns 最终位置信息（position + direction）
   */
  show(target: Node, step: GuideStep, excludeDirections?: Direction[], snap?: boolean,
    stepIndex?: number, totalSteps?: number): GuidePositionResult {
    this._stepIndex = stepIndex ?? -1;
    this._totalSteps = totalSteps ?? 0;
    const config = step.dialog;

    // ── 1. 设置文本 ──
    if (this.titleLabel) {
      if (config?.title) {
        this.titleLabel.string = config.title;
        this.titleLabel.node.active = true;
      } else {
        this.titleLabel.node.active = false;
      }
    }
    if (this.descriptionLabel) {
      if (config?.description) {
        this.descriptionLabel.string = config.description;
        this.descriptionLabel.node.active = true;
      } else {
        this.descriptionLabel.node.active = false;
      }
    }

    // ── 2. 构建优先级 ──
    const preferred = config?.position ?? 'auto';
    let priority: Direction[] = preferred === 'auto'
      ? [...DIALOG_PRIORITY]
      : [preferred as Direction, ...DIALOG_PRIORITY.filter(d => d !== preferred)];

    if (excludeDirections?.length) {
      const filtered = priority.filter(d => excludeDirections.indexOf(d) === -1);
      if (filtered.length > 0) priority = filtered;
    }

    const ox = config?.offset?.x ?? 0;
    const oy = config?.offset?.y ?? 0;

    // ── 3. 立即计算并返回（方向正确，位置可能因 Layout 未更新而有偏差） ──
    const result = GuidePosition.calc(this.node, target, { priority, offset: { x: ox, y: oy }, gap: this.guideGap });
    this.node.active = true;

    // ── 4. 延迟定位：等 Layout 更新后重新计算位置并执行动画 ──
    if (this._deferredPosition) {
      this.unschedule(this._deferredPosition);
    }
    this._deferredPosition = () => {
      this._deferredPosition = null;
      const r = GuidePosition.calc(this.node, target, { priority, offset: { x: ox, y: oy }, gap: this.guideGap });
      if (snap) {
        this.node.setPosition(r.position);
      } else {
        tween(this.node)
          .to(this.transitionDuration, { position: r.position }, { easing: 'smooth' })
          .start();
      }
    };
    this.scheduleOnce(this._deferredPosition, 0.05);

    return result;
  }

  /** 隐藏对话框 */
  hide(): void {
    if (this._deferredPosition) {
      this.unschedule(this._deferredPosition);
      this._deferredPosition = null;
    }
    tween(this.node).stop();
    this.node.active = false;
  }
}
