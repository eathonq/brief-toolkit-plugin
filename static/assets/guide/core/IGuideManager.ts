/**
 * IGuideManager.ts - 引导管理接口与类型定义
 * @description 定义引导系统的所有类型、接口与回调签名。
 *
 * @author eathonq
 * @license MIT
 * @version v1.3.0
 *
 * @created 2024-08-16
 * @modified 2026-06-12
 */

import { Rect, Vec3, Node, Vec2, Color } from "cc";
import { Direction, GuidePositionResult } from "./GuidePosition";

// ── 聚焦样式类型 ──

/** 聚焦形状 */
export type FocusShape = 'rectangle' | 'circle' | 'rounded_rect' | 'ellipse';

/** 聚焦样式 */
export type FocusStyle = {
  /** 形状类型（默认 'rectangle'） */
  shape: FocusShape;
  /** 目标区域外扩 px（默认 8） */
  margin: number;
  /** 步骤切换动画时长/秒（默认 0.3，0 = 无动画/snap） */
  switchDuration: number;
  /** 遮罩颜色（默认半透明黑） */
  maskColor: Color;
};

/** 步骤级聚焦覆盖（用于 GuideStep.focus） */
export type FocusStyleOverride = Partial<FocusStyle>;

// ── 默认值 ──

export const DEFAULT_FOCUS_STYLE: FocusStyle = {
  shape: 'rectangle',
  margin: 8,
  switchDuration: 0.3,
  maskColor: new Color(0, 0, 0, 180),
};

// ── 步骤交互类型 ──

/** 步骤触发类型 */
export type StepTriggerType =
  | 'click'        // 点击目标节点（默认）
  | 'input_done'   // EditBox 输入完成
  | 'slide'        // Slider 交互（拖拽/点击松手）
  | 'toggle'       // ToggleContainer 交互（点击任一切换选项）
  | 'page_turn'    // PageView 翻页交互
  ;

/** 步骤条件 */
export type StepCondition = {
  type: 'toggle_index' | 'page_index' | 'property_equal';
  params?: Record<string, any>;
};

// ── 对话 & 指示器配置 ──

/** 对话配置 */
export type DialogConfig = {
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 位置偏好（默认 auto） */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** 相对目标节点的偏移 */
  offset?: Vec2;
};

/** 指示器配置（存在即启用，不配则无指示器） */
export type PointerConfig = {
  /** 位置偏好（默认 auto） */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** 相对目标节点的偏移 */
  offset?: Vec2;
};

// ── 核心数据类型 ──

/** 引导步骤 */
export type GuideStep = {
  /** 步骤唯一标识（用于 jumpTo 跳转，不配则使用数组索引） */
  id?: string;

  /** 目标节点路径（使用 '>' 分段） */
  target: string;

  /** 触发类型（不配置则根据组件类型推断） */
  trigger?: StepTriggerType;
  /** 完成条件（满足条件时步骤才算完成） */
  condition?: StepCondition;

  /** 聚焦样式覆盖（不配置则使用 GuideSetting 全局配置） */
  focus?: FocusStyleOverride;

  /** 对话配置（存在即显示） */
  dialog?: DialogConfig;
  /**
   * 指示器配置。
   * - 不配：有 pointerPrefab 时默认显示
   * - false：强制不显示
   * - PointerConfig：显示 + 自定义配置
   */
  pointer?: PointerConfig | false;
};

/** 引导任务 */
export type GuideTask = {
  /** 任务标识 */
  key: string;
  /** 任务记录的当前步骤索引 */
  index?: number;
  /** 任务步骤 */
  steps: GuideStep[];

  // ── 步骤级回调（可选，用于埋点、音效等外部逻辑注入） ──
  /** 步骤进入时回调 */
  onStepEnter?: (stepIndex: number, step: GuideStep) => void;
  /** 步骤离开时回调 */
  onStepLeave?: (stepIndex: number, step: GuideStep) => void;
  /** 引导完成回调 */
  onComplete?: () => void;
  /** 引导中断回调 */
  onStop?: () => void;
};

/** 聚焦数据 */
export type FocusData = {
  /** 目标节点 */
  target: Node;
  /** 遮罩节点 */
  maskNode: Node;
  /** 目标节点的边界框 */
  rect: Rect,
  /** 目标节点的位置（相对于遮罩节点的局部坐标） */
  position: Vec3
};

// ── 回调类型 ──

export type FocusCallback = (focusData: FocusData, step: GuideStep) => void;

// ── 引导结果 ──

/** 引导执行结果 */
export type GuideResult = {
  completed: boolean;   // 是否走完所有步骤
  stoppedAt: number;    // 停在哪一步（interrupted 时有意义）
  totalSteps: number;   // 总共多少步
};

// ── 接口 ──

/** 指示器接口 */
export interface IGuidePointer {
  get node(): Node;
  /**
   * 显示指示器。返回最终位置信息。
   * @param excludeDirections 排除的方向数组（可选），定位时跳过这些方向
   * @param snap true 时直接定位不带动画（任务首次显示）
   */
  show(target: Node, step: GuideStep, excludeDirections?: Direction[], snap?: boolean): GuidePositionResult;
  /** 隐藏指示器 */
  hide(): void;
}

/** 对话接口 */
export interface IGuideDialog {
  get node(): Node;
  /**
   * 显示对话。先同步返回位置信息（方向可用于排除），
   * 再由 scheduleOnce 延迟执行实际定位，等待 Layout 更新。
   * @param excludeDirections 排除的方向数组（可选），定位时跳过这些方向
   * @param snap true 时直接定位不带动画（任务首次显示）
   * @param stepIndex 当前步骤索引（可选，用于进度指示器）
   * @param totalSteps 总步骤数（可选）
   */
  show(target: Node, step: GuideStep, excludeDirections?: Direction[], snap?: boolean,
       stepIndex?: number, totalSteps?: number): GuidePositionResult;
  /** 隐藏对话 */
  hide(): void;
}

/** 聚焦接口 */
export interface IGuideFocus {
  /** UI 挂载节点（dialog / pointer 等组件加到此节点下） */
  uiLayer: Node;

  /**
   * 高亮显示目标节点
   * @param target 目标节点
   * @param step 当前步骤
   * @param onFocusCallback 聚焦回调
   * @param snap true 时直接定位不带动画（用于首次显示或 jumpTo）
   */
  focusOn(target: Node, step: GuideStep, onFocusCallback?: FocusCallback, snap?: boolean): void;
  /**
   * 清除高亮，隐藏遮罩
   * @param snap true 时直接清除不带动画
   */
  clearFocus(snap?: boolean): void;

  /** 是否正在聚焦 */
  readonly hasFocus: boolean;
  /** 当前聚焦目标 */
  readonly currentTarget: Node | null;
}

/** 引导管理接口 */
export interface IGuideManager {
  /** 设置引导参数（task + stepAction 一次性注入） */
  setup(task: GuideTask, action: any): void;

  /**
   * 开始引导
   * @param stepIndex 起始步骤索引（可选，默认从 0 或上次记录位置开始）
   * @return Promise<GuideResult> 引导完成/中断时 resolve
   */
  startTask(stepIndex?: number): Promise<GuideResult>;
  /** 停止当前引导 */
  stopTask(): void;
  /** 回退到上一步 */
  previousStep(): void;
  /** 前进到下一步 */
  nextStep(): void;
  /**
   * 跳转到指定步骤（按 id 或索引）。
   * 仅在 running / paused 状态下有效。
   */
  jumpTo(stepIdOrIndex: string | number): void;
  /** 暂停当前引导 */
  pauseTask(): void;
  /** 恢复暂停的引导 */
  resumeTask(): void;
  /** 当前是否正在执行引导 */
  isRunning(): boolean;

  /** 获取当前任务进度 */
  getTaskRecord(): number | null;
}
