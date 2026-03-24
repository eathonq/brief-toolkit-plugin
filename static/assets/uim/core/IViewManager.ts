/**
 * IViewManager.ts - 视图管理接口
 * @description 该接口定义了视图管理的功能，包括视图的显示、关闭、切换等操作。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-13
 * @modified 2026-03-13
 */

/**
 * @example
 * protected onLoad() {
 *     // 注册视图事件
 *     this.node.on(ViewEvent, (state: ViewState, data?: any) => {
 *         // TODO
 *     }, this);
 * }
 */
export const ViewEvent = "VIEW_EVENT";

/** 视图事件回调状态 */
export enum ViewState {
  /** 显示 */
  Show = 0,
  /** 隐藏 */
  Hide = 1,
  /** 关闭 */
  Close = 2,
  /** 数据通知 */
  Data = 3,
}

/** 视图类型 */
export enum ViewType {
  /** 全屏视图 */
  View = 0,
  /** 消息框 */
  MessageBox = 1,
  /** 提示框 */
  Tooltip = 2,
}

export enum ViewSortIndex {
  /** View 下层 */
  ViewLow = 0,
  /** View 层 */
  View = 10,
  /** View 上层 */
  ViewHigh = 15,
  /** Menu 层 */
  Menu = 16,
  /** MessageBox 层 */
  MessageBox = 20,
  /** Tooltip 层 */
  Tooltip = 30,
  /** 最上层 */
  Top = 100,
}

export interface IViewManager {
  /**
   * 获取视图类型
   * @param name 视图名称
   * @returns 视图类型
   */
  getViewType(name: string): ViewType;

  /**
   * 检查视图是否存在
   * @param name 视图名称
   * @param type 视图类型
   * @returns 
   */
  checkView(name: string, type?: ViewType): boolean;

  /**
   * 获取所有视图名称（模板表中的视图）
   * @returns 所有视图名称
   */
  getAllViewNames(): string[];

  /**
   * 显示视图
   * @param name 视图名称
   * @param data 数据
   */
  show(name: string, data?: any): void;

  /**
   * 关闭视图
   * @param name 视图名称
   * @param data 数据
   */
  close(name: string, data?: any): void;

  /**
   * 是否是当前显示的最上层视图
   * @param name 视图名称
   * @returns 是否是当前显示的最上层视图
   */
  isTopView(name: string): boolean;

  /** 获取当前显示的最上层视图名称 */
  getCurrentViewName(): string;

  /**
   * 显示视图（该视图已经存在则关闭之前所有视图显示该视图）
   * @param name 视图名称(不填显示默认视图) 
   * @param data 数据
   */
  showView(name: string, data?: any): void;

  /**
   * 显示视图并替换当前视图（该视图已经存在则取出该视图显示替换）
   * @param name 视图名称
   * @param data 数据
   */
  showAsReplace(name: string, data?: any): void;

  /**
   * 显示视图做为根视图（该视图已经存在则取出该视图做为根视图）
   * @param name 视图名称
   * @param data 数据
   */
  showAsRoot(name: string, data?: any): void;

  /**
   * 视图后退（返回上一个显示的视图）
   * @param data 数据
   */
  backView(data?: any): void;

  /**
   * 关闭视图
   * @param name 视图名称
   * @param data 数据
   */
  closeView(name: string, data?: any): void;

  /**
   * 显示消息框
   * @param data 
   */
  showMessageBox(data: any): boolean;
  /**
   * 显示消息框
   * @param name 消息框名称(不填显示默认消息框)
   * @param data 数据
   */
  showMessageBox(name: string, data: any): boolean;

  /**
   * 关闭消息框
   * @param name 消息框名称(不填关闭默认消息框)
   * @param data 数据
   */
  closeMessageBox(name?: string, data?: any): void;

  /**
   * 显示提示框
   * @param data 数据
   */
  showTooltip(data: any): boolean;
  /**
   * 显示提示框
   * @param name 提示框名称(不填显示默认提示框)
   * @param data 数据
   */
  showTooltip(name: string, data: any): boolean;

  /**
   * 关闭提示框
   * @param name 提示框名称(不填关闭默认提示框)
   * @param data 数据
   */
  closeTooltip(name?: string, data?: any): void;
}

//#region MessageBox Data 
/** 消息框按钮 */
export enum MessageBoxButtons {
  /* 消息框无按钮。 */
  None = 0,
  /* 消息框包含“确定”按钮。 */
  OK = 1,
  /* 消息框包含“确定”和“取消”按钮。 */
  OKCancel = 2,

  /* 消息框包含“是”和“否”按钮。 */
  YesNo = 3,
  /* 消息框包含“是”、“否”和“取消”按钮。 */
  YesNoCancel = 4,

  /* 消息框包含“中止”、“重试”和“忽略”按钮。 */
  AbortRetryIgnore = 5,
}

/** 消息框结果 */
export enum MessageBoxResult {
  /** Nothing */
  None = 0,
  /** 确定 */
  OK = 1,
  /** 取消 */
  Cancel = 2,

  /** 是 */
  Yes = 3,
  /** 否 */
  No = 4,

  /** 中止 */
  Abort = 5,
  /** 重试 */
  Retry = 6,
  /** 忽略 */
  Ignore = 7,
}

/** 消息框数据 */
export type MessageBoxData = {
  /** 内容 */
  content: string;
  /** 标题 */
  title?: string;
  /** 显示按钮 */
  buttons?: MessageBoxButtons;

  /** 异步关闭回调（MessageBox声明，MessageBoxBase使用） */
  resolve?(result: MessageBoxResult): void;
}

//#endregion

//#region Tooltip Data

/** 提示框数据 */
export type TooltipData = {
  /** 内容 */
  content: string;
  /** 是否显示关闭按钮 */
  isClose?: boolean;
  /** 超时时间 */
  timeout?: number;

  /** 关闭回调（Tooltip声明，TooltipBase使用） */
  closeCallback?(): void;
  /** 超时回调（TooltipBase声明，Tooltip使用） */
  timeoutCallback?(): void;
}

//#endregion

