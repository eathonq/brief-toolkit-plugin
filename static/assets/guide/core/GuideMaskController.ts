/**
 * GuideMaskController.ts - 引导遮罩控制器
 * @description 该类负责创建和管理遮罩节点，提供高亮目标节点的功能。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-17
 * @modified 2026-03-17
 */

import { Node, Mask, Graphics, UITransform, v3, Input, EventTouch, Color, Size } from 'cc';
import { FocusCallback, GuideStep, IGuideMask } from './IGuideManager';

type GuideMaskOptions = {
  /** 是否启用遮罩，默认值为 true */
  mask?: boolean;
  /** 遮罩颜色，默认值为Color(0, 0, 0, 255) */
  maskColor?: Color;
};

/**
 * 引导遮罩控制器
 * 负责创建和管理遮罩节点，提供高亮目标节点的功能
 */
export class GuideMaskController implements IGuideMask {
  // 核心节点（对外暴露只读访问）
  private _node: Node;
  public get node(): Node { return this._node; }

  /** mask组件引用 */
  private graphics: Graphics;

  // 状态
  private target: Node | null = null;

  private config: GuideMaskOptions = {
    mask: true,
    maskColor: new Color(0, 0, 0, 255),
  };

  constructor(parent: Node, options: GuideMaskOptions = {}) {
    // 合并配置
    Object.assign(this.config, options);

    const rootNode = this.initRootNode(parent);
    parent.addChild(rootNode);
    if (this.config.mask) {
      this.initTouchEvents(rootNode);
    }

    const maskNode = this.initMaskNode(rootNode);
    this.graphics = maskNode.getComponent(Graphics);

    const displayNode = this.initBackgroundNode(maskNode);
    maskNode.addChild(displayNode);

    this._node = rootNode;
    this._node.active = false; // 初始隐藏
  }

  // 初始化根节点（用于接收触摸事件）
  private initRootNode(parent: Node) {
    const touchNode = new Node('GuideTouchNode');
    parent.addChild(touchNode);

    const { width, height } = parent.getComponent(UITransform).contentSize;

    // 2. 添加UITransform设置大小
    touchNode.addComponent(UITransform).contentSize = new Size(width, height);

    return touchNode;
  }

  // 初始化遮罩层
  private initMaskNode(parent: Node) {
    // 1. 创建根节点
    const node = new Node('GuideMaskNode');
    parent.addChild(node);

    const { width, height } = parent.getComponent(UITransform).contentSize;

    // 2. 添加UITransform设置大小
    node.addComponent(UITransform).contentSize = new Size(width, height);

    // 3. 添加Graphics组件绘制纯色矩形（方案A）
    const graphics = node.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, 255);
    graphics.fillRect(-width / 2, -height / 2, width, height);

    // 4. 添加Mask组件设置遮罩
    const mask = node.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    mask.inverted = true;

    return node;
  }

  // 初始化背景层
  private initBackgroundNode(parent: Node) {
    // 1. 创建阻塞层节点
    const node = new Node('GuideMaskBackgroundNode');
    parent.addChild(node);

    const { width, height } = parent.getComponent(UITransform).contentSize;

    // 2. 添加UITransform设置大小
    node.addComponent(UITransform).contentSize = new Size(width, height);

    // 3. 添加Graphics组件绘制纯色矩形
    const graphics = node.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = this.config.maskColor;
    graphics.fillRect(-width / 2, -height / 2, width, height);

    return node;
  }

  /**
   * 初始化触摸事件处理
   */
  private initTouchEvents(touchNode: Node) {
    // 触摸开始：判断是否点击到目标节点
    touchNode.on(Input.EventType.TOUCH_START, (touch: EventTouch) => {
      if (!this.target) return;

      const rect = this.target.getComponent(UITransform).getBoundingBoxToWorld();
      if (rect.contains(touch.getLocation())) {
        // 点击到目标节点，允许事件穿透
        touch.preventSwallow = true;
      } else {
        // 点击到遮罩区域，阻止事件传递
        touch.preventSwallow = false;
      }
    }, touchNode);

    // 其他事件统一阻止传递（避免事件穿透到下层）
    [Input.EventType.TOUCH_END, Input.EventType.TOUCH_MOVE, Input.EventType.TOUCH_CANCEL]
      .forEach(type => {
        touchNode.on(type, (touch: EventTouch) => {
          if (!this.target) return;
          // 阻止所有非目标节点的事件传递
          touch.preventSwallow = true;
        }, touchNode);
      });
  }

  /**
   * 高亮显示目标节点
   * @param target 目标节点
   * @param step 当前步骤
   * @param onFocusCallback 聚焦回调
   * @returns 聚焦数据（包含目标节点、遮罩节点、目标节点的边界框和位置）
   */
  focusOn(target: Node, step: GuideStep, onFocusCallback?: FocusCallback) {
    if (!target) {
      console.warn('GuideMaskController: target is null');
      return;
    }

    this.target = target;
    this._node.active = true;

    // 重置图形
    this.graphics.clear();

    // 获取目标节点的变换信息
    const transform = target.getComponent(UITransform);
    if (!transform) {
      console.error(`GuideMaskController: target ${target.name} has no UITransform`);
      return;
    }

    // 计算目标节点的位置和大小
    const rect = transform.getBoundingBox();
    const rect_pt_world = transform.convertToWorldSpaceAR(v3(rect.x, rect.y));
    const p = transform.convertToNodeSpaceAR(v3(rect_pt_world.x, rect_pt_world.y));

    // 绘制遮罩上的"空洞"（即目标节点区域）
    this.graphics.fillRect(p.x, p.y, rect.width, rect.height);

    // 调用聚焦回调
    if (onFocusCallback) {
      onFocusCallback({
        target,
        maskNode: this._node,
        rect,
        position: p,
      }, step);
    }
  }

  /**
   * 清除高亮，隐藏遮罩
   */
  clearFocus() {
    this.target = null;
    this._node.active = true; // 保持激活直到动画结束

    // 清除图形（遮罩恢复全屏）
    this.graphics.clear();
    this.graphics.fillRect(0, 0, 0, 0);

    this._node.active = false; // 立即隐藏
  }

  /**
   * 更新配置
   */
  updateConfig(options: Partial<typeof GuideMaskController.prototype.config>) {
    Object.assign(this.config, options);
  }

  /**
   * 销毁资源
   */
  destroy() {
    this._node.destroy();
  }

  // 检查当前是否有高亮目标
  get hasFocus(): boolean {
    return this.target !== null;
  }

  // 获取当前高亮的目标
  get currentTarget(): Node | null {
    return this.target;
  }
}