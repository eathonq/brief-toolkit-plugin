/**
 * IGuideManager.ts - 引导管理接口
 * @description 该接口定义了引导管理器的功能，包括任务的启动、加载和记录查询。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-16
 * @modified 2026-03-17
 */

import { Rect, Vec3, Node } from "cc";

/** 引导步骤 */
export type GuideStep = {
  /** 目标节点路径 */
  target: string;
  /** 步骤标题 */
  title?: string;
  /** 步骤描述 */
  description?: string;
  /** 步骤事件数据 */
  eventData?: any;
}

/** 引导任务 */
export type GuideTask = {
  /** 任务标识 */
  key: string;
  /** 任务记录的当前步骤索引 */
  index?: number;
  /** 任务步骤 */
  steps: GuideStep[];
}

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
}

export type FocusCallback = (focusData: FocusData, step: GuideStep) => void;

export interface IGuideMask {
  /**
   * 高亮显示目标节点
   * @param target 目标节点
   * @param onFocusCallback 聚焦回调
   */
  focusOn(target: Node, step: GuideStep, onFocusCallback?: FocusCallback): void;
  /**
   * 清除高亮，隐藏遮罩
   */
  clearFocus(): void;
}

export type StepCallback = (step: GuideStep, nextIndex: number) => void;

export type StartTaskOptions = {
  /** 指定步骤索引（可选，默认从当前记录的步骤开始） */
  stepIndex?: number;
  /** 聚焦回调 (可选，每个步骤的聚焦时候回调，参数为当前步骤的聚焦数据和当前步骤) */
  onFocusCallback?: FocusCallback;
  /** 任务步骤回调 (可选，每完成一个步骤的回调，参数为当前步骤数据和下一步骤索引) */
  onStepCallback?: StepCallback;
}

/** 引导管理接口 */
export interface IGuideManager {
  /**
   * 开始任务
   * @param key 任务标识
   * @param options 任务选项
    * @return Promise<void> 任务完成的 Promise
   */
  startTask(key: string, options?: StartTaskOptions): Promise<void>;

  /**
   * 加载引导任务
   * @param task 引导任务
   */
  loadTask(task: GuideTask): void;

  /**
   * 获取任务记录的当前步骤索引
   * @param key 任务标识
   * @return 当前步骤索引，若任务不存在则返回 null
   */
  getTaskRecord(key: string): number | null;
}