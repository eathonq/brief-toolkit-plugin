/**
 * GuideFocus.ts - 引导聚焦 V2
 * @description 负责创建和管理聚焦节点，提供目标高亮、背景遮挡、触摸拦截功能。
 *              V2 新增：多形状、进入/退出/切换动画。
 *
 *              动画机制：
 *              - 切换动画：tween 代理对象 → onUpdate 逐帧 Graphics 重绘镂空位置/大小
 *              - 进入/退出：tween 代理对象 → onUpdate 逐帧重绘 overlay fillColor alpha
 *              - 形状：Graphics.fillRect / circle+fill / roundRect+fill
 *              - 遮罩透明度：Graphics.fillColor.a 直接控制
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2026-03-17
 * @modified 2026-06-12
 */

import { Node, Mask, Graphics, UITransform, v3, Input, EventTouch, Color, Size, Tween, tween } from 'cc';
import {
  FocusCallback, GuideStep, IGuideFocus,
  FocusStyle, DEFAULT_FOCUS_STYLE, FocusStyleOverride,
} from './IGuideManager';
import { GuidePosition } from './GuidePosition';

// ── 内部类型 ──

/** 镂空矩形（相对于 mask 父节点的本地坐标） */
interface CutoutRect { x: number; y: number; w: number; h: number; }

/** overlay 节点 + Graphics 缓存 */
interface OverlayCfg {
  node: Node;
  graphics: Graphics;
  /** 全屏尺寸缓存（避免重复查询 UITransform） */
  screenW: number;
  screenH: number;
}

/**
 * 引导聚焦
 *
 * 节点层级：
 * ```
 * GuideFocusTouchNode (全屏触摸拦截)
 *   ├── GuideFocusMaskNode    (Mask: inverted + GRAPHICS_RECT)
 *   │     └── GuideFocusOverlayNode  (Graphics 全屏纯色 fillRect，alpha 控制透明度)
 *   └── (touch events)
 * GuideFocusUILayer (dialog / pointer 挂载，与 TouchNode 平级)
 * ```
 */
export class GuideFocus implements IGuideFocus {
  private _node: Node = null!;
  get node(): Node { return this._node; }

  private _uiLayer: Node = null!;
  get uiLayer(): Node { return this._uiLayer; }

  private _maskNode: Node = null!;
  private _overlay: OverlayCfg = null!;

  /** MaskNode 上的 Graphics（定义镂空形状） */
  private _maskGfx: Graphics = null!;

  /** 当前高亮目标 */
  private _target: Node | null = null;
  get hasFocus(): boolean { return this._target !== null; }
  get currentTarget(): Node | null { return this._target; }

  /** 当前镂空矩形（为 null 表示从未绘制过） */
  private _currentRect: CutoutRect | null = null;

  /** 活跃的 tween */
  private _activeTween: Tween<any> | null = null;

  /** 当前样式 */
  private _style: FocusStyle;

  /** 全局基准样式（来自 GuideSetting，步骤级 focus 覆盖始终以此为基准合并） */
  private _baseStyle: FocusStyle;

  /** 触摸拦截开关 */
  private _blockTouch: boolean;
  /** 遮罩显示开关 */
  private _showMask: boolean;

  constructor(parent: Node, options?: Partial<FocusStyle> & { blockTouch?: boolean; showMask?: boolean }) {
    this._blockTouch = options?.blockTouch ?? true;
    this._showMask = options?.showMask ?? true;
    this._style = GuideFocus._resolveStyle(options);
    // 保存全局基准，步骤级 focus 覆盖始终以此为 base 合并，避免前一步覆盖污染后续步骤
    this._baseStyle = GuideFocus._resolveStyle(options);

    const rootNode = this._initRootNode(parent);
    parent.addChild(rootNode);
    this._initTouchEvents(rootNode);

    const maskNode = this._initMaskNode(rootNode);
    this._maskNode = maskNode;
    this._maskGfx = maskNode.getComponent(Graphics)!;

    const overlay = this._initOverlay(maskNode);
    this._overlay = overlay;
    maskNode.addChild(overlay.node);

    // UI 挂载层 — 与 TouchNode 平级
    this._uiLayer = new Node('GuideFocusUILayer');
    const ps = parent.getComponent(UITransform)!.contentSize;
    this._uiLayer.addComponent(UITransform).contentSize = new Size(ps.width, ps.height);
    parent.addChild(this._uiLayer);

    this._node = rootNode;
    this._node.active = false;
  }

  // ── 公开方法 ──

  focusOn(target: Node, step: GuideStep, onFocusCallback?: FocusCallback, snap?: boolean): void {
    if (!target) { console.warn('GuideFocus: target is null'); return; }

    const ut = target.getComponent(UITransform);
    if (!ut) {
      console.error(`GuideFocus: target ${target.name} has no UITransform`);
      return;
    }

    // 合并 step 级别样式覆盖，始终以全局基准为底，避免上一步覆盖污染当前步骤
    this._style = step.focus
      ? GuideFocus._resolveStyle(step.focus, this._baseStyle)
      : { ...this._baseStyle, maskColor: this._baseStyle.maskColor.clone() };
    this._redrawOverlay(this._style.maskColor.a);

    this._stopActiveTween();

    const newRect = this._calcCutoutRect(ut, this._style.margin);

    this._node.active = true;
    this._target = target;

    const dur = snap ? 0 : this._style.switchDuration;
    const wasFocused = this._currentRect !== null;

    if (snap || !wasFocused) {
      this._drawCutout(newRect);
      this._redrawOverlay(this._style.maskColor.a);
      this._showOverlay();
    } else {
      this._animateSwitch(this._currentRect!, newRect, dur);
    }

    this._currentRect = newRect;

    // 回调
    if (onFocusCallback) {
      const worldBBox = ut.getBoundingBoxToWorld();
      const maskParent = this._node.parent;
      const maskTransform = maskParent?.getComponent(UITransform);
      let localPos = v3(newRect.x, newRect.y, 0);
      if (maskTransform) {
        const lm = maskTransform.convertToNodeSpaceAR(v3(worldBBox.xMin, worldBBox.yMin, 0));
        localPos = v3(lm.x, lm.y, 0);
      }
      onFocusCallback({ target, maskNode: this._node, rect: worldBBox, position: localPos }, step);
    }
  }

  clearFocus(snap?: boolean): void {
    if (!this._target) return;
    this._stopActiveTween();
    this._doClear();
  }

  updateStyle(style: Partial<FocusStyle>): void {
    this._style = GuideFocus._resolveStyle(style, this._style);
    if (this.hasFocus && this._currentRect) {
      this._drawCutout(this._currentRect);
      this._redrawOverlay(this._style.maskColor.a);
    }
  }

  destroy(): void {
    this._stopActiveTween();
    this._node?.destroy();
  }

  // ── 节点初始化 ──

  private _initRootNode(parent: Node): Node {
    const node = new Node('GuideFocusTouchNode');
    const { width, height } = parent.getComponent(UITransform)!.contentSize;
    node.addComponent(UITransform).contentSize = new Size(width, height);
    return node;
  }

  private _initMaskNode(parent: Node): Node {
    const node = new Node('GuideFocusMaskNode');
    parent.addChild(node);

    const { width, height } = parent.getComponent(UITransform)!.contentSize;
    node.addComponent(UITransform).contentSize = new Size(width, height);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(0, 0, 0, 255);
    graphics.fillRect(-width / 2, -height / 2, width, height);

    const mask = node.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    mask.inverted = true;

    return node;
  }

  /** overlay：全屏纯色 Graphics，透明度由 fillColor.a 直接控制 */
  private _initOverlay(parent: Node): OverlayCfg {
    const node = new Node('GuideFocusOverlayNode');
    const { width, height } = parent.getComponent(UITransform)!.contentSize;
    node.addComponent(UITransform).contentSize = new Size(width, height);

    const graphics = node.addComponent(Graphics);
    // showMask=false 时不绘制初始填充，避免激活时残留旧颜色
    if (this._showMask) {
      const mc = this._style.maskColor;
      graphics.fillColor = mc.clone();
      graphics.fillRect(-width / 2, -height / 2, width, height);
    }

    return { node, graphics, screenW: width, screenH: height };
  }

  // ── 触摸拦截 ──

  private _initTouchEvents(touchNode: Node): void {
    touchNode.on(Input.EventType.TOUCH_START, (touch: EventTouch) => {
      if (!this._blockTouch) { touch.preventSwallow = true; return; }
      if (!this._target) return;
      const r = this._target.getComponent(UITransform)!.getBoundingBoxToWorld();
      if (r.contains(touch.getLocation())) {
        touch.preventSwallow = true;
      } else {
        touch.preventSwallow = false;
      }
    }, touchNode);

    [Input.EventType.TOUCH_END, Input.EventType.TOUCH_MOVE, Input.EventType.TOUCH_CANCEL]
      .forEach(type => {
        touchNode.on(type, (touch: EventTouch) => {
          if (!this._blockTouch) { touch.preventSwallow = true; return; }
          if (!this._target) return;
          touch.preventSwallow = true;
        }, touchNode);
      });
  }

  // ── 镂空计算 ──

  private _calcCutoutRect(ut: UITransform, margin: number): CutoutRect {
    const b = GuidePosition.getBoundsInParent(ut, this._node.parent!);
    if (!b) {
      const wb = ut.getBoundingBoxToWorld();
      return { x: 0, y: 0, w: wb.width, h: wb.height };
    }
    return {
      x: b.x - margin,
      y: b.y - margin,
      w: b.width + margin * 2,
      h: b.height + margin * 2,
    };
  }

  // ── 形状绘制 ──

  private _drawCutout(rect: CutoutRect, scale: number = 1): void {
    const g = this._maskGfx;
    g.clear();

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const sw = rect.w * scale;
    const sh = rect.h * scale;
    const sx = cx - sw / 2;
    const sy = cy - sh / 2;

    this._resetMaskScale();

    switch (this._style.shape) {
      case 'rectangle':
        g.fillRect(sx, sy, sw, sh);
        break;
      case 'circle': {
        g.circle(cx, cy, Math.min(sw, sh) / 2);
        g.fill();
        break;
      }
      case 'rounded_rect': {
        g.roundRect(sx, sy, sw, sh, Math.min(sw, sh) * 0.15);
        g.fill();
        break;
      }
      case 'ellipse': {
        g.ellipse(cx, cy, sw / 2, sh / 2);
        g.fill();
        break;
      }
    }
  }

  private _resetMaskScale(): void {
    if (this._maskNode) this._maskNode.setScale(1, 1, 1);
  }

  // ── overlay 绘制 ──

  /** 用指定 alpha 重绘 overlay（全屏填充）。showMask=false 时 no-op */
  private _redrawOverlay(alpha: number): void {
    if (!this._overlay || !this._showMask) return;
    const g = this._overlay.graphics;
    const mc = this._style.maskColor;
    g.clear();
    g.fillColor = new Color(mc.r, mc.g, mc.b, alpha);
    g.fillRect(-this._overlay.screenW / 2, -this._overlay.screenH / 2,
      this._overlay.screenW, this._overlay.screenH);
  }

  /** 显示 overlay（激活节点）。showMask=false 时 no-op */
  private _showOverlay(): void {
    if (this._overlay && this._showMask) this._overlay.node.active = true;
  }

  // ── 动画 ──

  private _stopActiveTween(): void {
    if (this._activeTween) {
      this._activeTween.stop();
      this._activeTween = null;
    }
  }

  /**
   * 切换动画：镂空位置+大小从旧到新平滑过渡。
   * overlay 保持可见。
   */
  private _animateSwitch(from: CutoutRect, to: CutoutRect, duration: number): void {
    this._showOverlay(); // 走 _showOverlay 的 _showMask 守卫
    this._redrawOverlay(this._style.maskColor.a);

    const proxy = { x: from.x, y: from.y, w: from.w, h: from.h };

    this._activeTween = tween(proxy)
      .to(duration, { x: to.x, y: to.y, w: to.w, h: to.h }, {
        easing: 'smooth',
        onUpdate: () => {
          this._drawCutout({ x: proxy.x, y: proxy.y, w: proxy.w, h: proxy.h });
        },
      })
      .call(() => { this._activeTween = null; })
      .start();
  }

  /** 内部清理 */
  private _doClear(): void {
    this._target = null;
    this._currentRect = null;
    this._maskGfx.clear();

    if (this._node.parent) {
      const { width, height } = this._node.parent.getComponent(UITransform)!.contentSize;
      this._maskGfx.fillRect(-width / 2, -height / 2, width, height);
    }

    this._resetMaskScale();
    this._node.active = false;
    this._activeTween = null;
  }

  // ── 静态工具 ──

  private static _resolveStyle(
    override?: Partial<FocusStyle> & { blockTouch?: boolean } | FocusStyleOverride,
    base: FocusStyle = DEFAULT_FOCUS_STYLE,
  ): FocusStyle {
    if (!override) {
      return { ...base, maskColor: base.maskColor.clone() };
    }
    return {
      shape: override.shape ?? base.shape,
      margin: override.margin ?? base.margin,
      switchDuration: override.switchDuration ?? base.switchDuration,
      maskColor: override.maskColor ? override.maskColor.clone() : base.maskColor.clone(),
    };
  }
}
