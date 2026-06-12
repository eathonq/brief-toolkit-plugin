/**
 * GuidePosition.ts - 引导位置计算工具
 * @description 统一的节点定位工具，根据目标节点和屏幕空间计算最优位置与方向。
 *              对话框和指示器共用此工具。
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2026-06-11
 * @modified 2026-06-12
 */

import { Node, UITransform, Vec3, view, v3 } from 'cc';

/** 方向类型 */
export type Direction = 'top' | 'bottom' | 'left' | 'right';
const ALL_DIRECTIONS: Direction[] = ['bottom', 'top', 'right', 'left'];

/** 目标节点（含子节点）在指定参照坐标系下的包围盒矩形 */
export type BoundsInParent = {
  /** 左下角 x（参照父节点坐标系） */
  x: number;
  /** 左下角 y（参照父节点坐标系） */
  y: number;
  /** 宽度（含所有子节点） */
  width: number;
  /** 高度（含所有子节点） */
  height: number;
};

const GUIDE_GAP = 8;
const GUIDE_MARGIN = 8;

/** 位置计算结果 */
type Pos = { x: number; y: number };

/** calc 返回值 */
export type GuidePositionResult = {
  position: Vec3;
  direction: Direction;
};

/** calc 选项 */
export type CalcOptions = {
  /** 方向优先级（默认 ['bottom', 'top', 'right', 'left']） */
  priority?: Direction[];
  /** 额外偏移 */
  offset?: { x: number; y: number };
  /** 与目标节点的间距（默认 12） */
  gap?: number;
  /** 屏幕安全边距（默认 12） */
  safeMargin?: number;
};

/**
 * 引导位置计算工具
 *
 * 按优先级数组依次尝试各方向，返回第一个能放下节点的位置和方向。
 */
export class GuidePosition {
  /**
   * 按优先级尝试各个方向，返回第一个能放下的位置+方向
   * @param node 需要定位的节点（对话框或指示器）
   * @param target 目标节点（被引导的 UI 元素）
   * @param options 计算选项
   * @returns 位置和方向
   */
  static calc(node: Node, target: Node, options?: CalcOptions): GuidePositionResult {
    const priority = options?.priority;
    const ox = options?.offset?.x ?? 0;
    const oy = options?.offset?.y ?? 0;
    const gap = options?.gap ?? GUIDE_GAP;
    const safeMargin = options?.safeMargin ?? GUIDE_MARGIN;

    const ctx = GuidePosition._context(node, target);
    if (!ctx) return { position: v3(0, 0, 0), direction: 'bottom' };

    const { lp, tw, th, nw, nh, screen } = ctx;

    for (const dir of priority?.length ? priority : ALL_DIRECTIONS) {
      const p = GuidePosition._tryFit(lp, tw, th, nw, nh, dir, screen, ox, oy, gap, safeMargin);
      if (p) return { position: p, direction: dir };
    }

    const fallback = GuidePosition._pos(lp, tw, th, nw, nh, 'bottom', ox, oy, gap);
    return { position: v3(fallback.x, fallback.y, 0), direction: 'bottom' };
  }

  /**
   * 计算目标 UITransform（含子节点）在参照父节点坐标系下的包围盒。
   * 供 GuideFocus 镂空计算和自身定位计算共用，保证算法一致。
   */
  static getBoundsInParent(ut: UITransform, referenceParent: Node): BoundsInParent | null {
    const worldBBox = ut.getBoundingBoxToWorld();
    const pt = referenceParent.getComponent(UITransform);
    if (!pt) return null;

    const min = pt.convertToNodeSpaceAR(v3(worldBBox.xMin, worldBBox.yMin, 0));
    const max = pt.convertToNodeSpaceAR(v3(worldBBox.xMax, worldBBox.yMax, 0));
    return { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };
  }

  private static _context(node: Node, target: Node) {
    const tt = target.getComponent(UITransform);
    if (!tt) return null;
    const parent = node.parent;
    if (!parent) return null;

    const b = GuidePosition.getBoundsInParent(tt, parent);
    if (!b) return null;

    return {
      lp: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      tw: b.width, th: b.height,
      nw: node.getComponent(UITransform)?.width ?? 400,
      nh: node.getComponent(UITransform)?.height ?? 80,
      screen: view.getVisibleSize(),
    } as const;
  }

  private static _pos(
    lp: Pos, tw: number, th: number,
    nw: number, nh: number,
    dir: Direction, ox: number, oy: number, gap: number,
  ): Pos {
    let x = lp.x + ox, y = lp.y + oy;
    switch (dir) {
      case 'top':    y = lp.y + th / 2 + gap + nh / 2 + oy; break;
      case 'bottom': y = lp.y - th / 2 - gap - nh / 2 + oy; break;
      case 'left':   x = lp.x - tw / 2 - gap - nw / 2 + ox; y = lp.y + oy; break;
      case 'right':  x = lp.x + tw / 2 + gap + nw / 2 + ox; y = lp.y + oy; break;
    }
    return { x, y };
  }

  private static _tryFit(
    lp: Pos, tw: number, th: number,
    nw: number, nh: number,
    dir: Direction, screen: { width: number; height: number },
    ox: number, oy: number, gap: number, safeMargin: number,
  ): Vec3 | null {
    const hw = nw / 2, hh = nh / 2;
    const raw = GuidePosition._pos(lp, tw, th, nw, nh, dir, ox, oy, gap);

    switch (dir) {
      case 'top':    if (raw.y + hh >  screen.height / 2 - safeMargin) return null; break;
      case 'bottom': if (raw.y - hh < -screen.height / 2 + safeMargin) return null; break;
      case 'left':   if (raw.x - hw < -screen.width  / 2 + safeMargin) return null; break;
      case 'right':  if (raw.x + hw >  screen.width  / 2 - safeMargin) return null; break;
    }

    const x = Math.max(-screen.width / 2 + hw + safeMargin, Math.min(screen.width / 2 - hw - safeMargin, raw.x));
    const y = Math.max(-screen.height / 2 + hh + safeMargin, Math.min(screen.height / 2 - hh - safeMargin, raw.y));

    return v3(x, y, 0);
  }
}
