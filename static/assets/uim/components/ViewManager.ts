/**
 * ViewManager.ts - 视图管理绑定组件
 * @description 该组件实现了 IViewManager 接口，提供了视图管理的核心功能，包括视图的显示、隐藏、关闭、数据通知等操作，并支持视图的层级管理（View、MessageBox、Tooltip）。通过该组件，开发者可以方便地在项目中管理各种类型的视图，并且可以在编辑器中配置默认视图和预制体列表。
 * @important 在 Cocos Creator 中，通常挂载在场景根节点或常驻节点（如Canvas、RootNode）上。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/viewmanager}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-01-30
 * @modified 2026-03-12
 */

import { _decorator, Node, Component, Prefab, instantiate, Enum, CCClass } from 'cc';
import { EDITOR } from 'cc/env';
import { IViewManager, ViewEvent, ViewState, ViewType } from '../core/IViewManager';
import { ViewBase } from './ViewBase';
import { Views } from '../core/Views';
import { MessageBox } from '../core/MessageBox';
import { Tooltip } from '../core/Tooltip';
import { ViewSort } from './ViewSort';

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

const NullDefaultView = "NULL";

/** 视图项 */
class ViewItem {
  /** 视图状态 */
  private _state: ViewState = ViewState.Hide;
  /** 视图基础数据 */
  private _viewBase: ViewBase = null;

  /** 视图状态 */
  get state() {
    return this._state;
  }

  /** 视图基础数据 */
  get viewBase() {
    return this._viewBase;
  }

  /** 视图名称 */
  get viewName() {
    return this._viewBase.viewName;
  }

  /**
   * 视图项
   * @param viewBase 视图基类
   * @param doClose 关闭回调
   * @param doBack 返回回调
   */
  constructor(viewBase: ViewBase, doClose?: (name: string, data?: any) => void, doBack?: () => void) {
    this._viewBase = viewBase;

    if (doClose) {
      this._viewBase['doClose'] = doClose;
    }
    if (doBack) {
      this._viewBase['doBack'] = doBack;
    }
  }

  /**
   * 显示视图
   * @param data 数据
   */
  show(data?: any) {
    if (this._state == ViewState.Show) return;
    this._state = ViewState.Show;

    this._viewBase.node.active = true;
    this._viewBase.node.emit(ViewEvent, ViewState.Show, data);
  }

  /**
   * 隐藏视图
   * @param data 数据
   */
  hide(data?: any) {
    if (this._state != ViewState.Show) return;
    this._state = ViewState.Hide;

    this._viewBase.node.emit(ViewEvent, ViewState.Hide, data);
    this._viewBase.node.active = false;
  }

  /**
   * 关闭视图
   * @param data 数据
   */
  close(data?: any) {
    if (this._state == ViewState.Close) return;
    this._state = ViewState.Close;

    this._viewBase.node.emit(ViewEvent, ViewState.Close, data);
    this._viewBase.node.active = false;
    if (!this._viewBase.isCache) {
      this._viewBase.node.destroy();
    }
    this._viewBase = null;
  }

  /**
   * 数据通知
   * @param data 数据
   */
  data(data?: any) {
    if (this._state != ViewState.Show) return;
    this._viewBase.node.emit(ViewEvent, ViewState.Data, data);
  }
}

/** 视图栈(先进后出) */
class ViewStack {
  private list: ViewItem[] = [];

  getViewItem(name: string): ViewItem {
    return this.list.find(v => v.viewName === name);
  }

  getTopViewItem(): ViewItem {
    if (this.list.length == 0) return null;
    return this.list[this.list.length - 1];
  }

  isTop(name: string): boolean {
    if (this.list.length == 0) return false;
    const topView = this.list[this.list.length - 1];
    return topView.viewName === name;
  }

  /**
   * 添加到栈顶（最后一个视图）
   * @param viewItem 视图信息
   * @param data 数据
   */
  push(viewItem: ViewItem, data?: any): void {
    if (!viewItem) return;

    // 关闭当前最后一个视图
    if (this.list.length > 0) {
      const current = this.list[this.list.length - 1];
      current.hide();
    }

    //添加到当前最后一个视图，并显示
    this.list.push(viewItem);
    viewItem.show(data);
  }

  /**
   * 添加到栈顶（最后一个视图），并替换当前最后一个视图
   * @param viewItem 视图信息
   * @param data 数据
   */
  replaceTop(viewItem: ViewItem, data?: any): void {
    if (!viewItem) return;

    // 关闭当前最后一个视图
    if (this.list.length > 0) {
      const current = this.list.pop();
      current.close();
    }

    //添加到当前最后一个视图，并显示
    this.list.push(viewItem);
    viewItem.show(data);
  }

  /**
   * 清空当前所有视图，添加到栈顶（最后一个视图）
   * @param viewItem 视图信息
   * @param data 数据
   */
  setAsRoot(viewItem: ViewItem, data?: any): void {
    if (!viewItem) return;

    // 关闭当前所有所有视图
    while (this.list.length > 0) {
      const current = this.list.pop();
      current.close();
    }

    //添加到当前最后一个视图，并显示
    this.list.push(viewItem);
    viewItem.show(data);
  }

  /**
   * 弹出栈顶（最后一个视图）
   * @param data 数据
   * @param isRemove 是否移除（传递的数据给到移除的视图）
   */
  pop(data?: any, isRemove = false): void {
    // 关闭当前最后一个视图
    if (this.list.length > 0) {
      const current = this.list.pop();
      current.close(isRemove ? data : null);
    }

    // 显示当前最后一个视图
    if (this.list.length > 0) {
      const showView = this.list[this.list.length - 1];
      showView.show(isRemove ? null : data);
    }
  }

  /** 
   * 弹出直到某个视图
   * @param name 视图名称
   * @param data 数据
   */
  popTo(name: string, data?: any): boolean {
    if (!name) return false;

    const index = this.list.findIndex(v => v.viewName === name);
    if (index != -1) {
      // 已经是当前视图，不需要再操作
      if (index == this.list.length - 1) return true;

      // 关闭前面所有的视图
      while (this.list.length > index + 1) {
        const closeView = this.list.pop();
        closeView.close();
      }

      // 显示当前最后一个视图
      if (this.list.length > 0) {
        const showView = this.list[this.list.length - 1];
        showView.show(data);
      }

      return true;
    }

    return false;
  }

  /**
   * 移除某个视图
   * @param name 视图名称
   * @param data 数据（传递的数据给到移除的视图）
   */
  remove(name: string, data?: any) {
    const index = this.list.findIndex(v => v.viewName === name);
    if (index != -1) {
      // 最后一个视图，弹出
      if (index == this.list.length - 1) return this.pop(data, true);

      // 不是最后一个视图，直接关闭
      const closeView = this.list.splice(index, 1);
      closeView[0].close(data);
    }
  }

  /**
   * 分离指定视图（从栈中移除但不执行任何生命周期操作，显示、关闭、隐藏等）
   * @param name 视图名称
   * @returns 视图信息
   */
  detach(name: string) {
    const index = this.list.findIndex(v => v.viewName === name);
    if (index != -1) {
      // 不是最后一个视图，直接分离
      return this.list.splice(index, 1)[0];
    }
    return null;
  }
}

/** 消息框队列 */
class MessageBoxQueue {
  private list: ViewItem[] = [];

  getViewItem(name: string): ViewItem {
    return this.list.find(v => v.viewName === name);
  }

  /**
   * 添加消息框
   * @param viewItem 
   * @param data 
   * @returns 
   */
  push(viewItem: ViewItem, data?: any) {
    if (!viewItem) return;
    viewItem.show(data);
    this.list.push(viewItem);
  }

  /**
   * 移除消息框
   * @param viewItem 
   * @param data 
   * @returns 
   */
  remove(viewItem: ViewItem, data?: any) {
    if (!viewItem) return;
    viewItem.close(data);
    this.list.splice(this.list.indexOf(viewItem), 1);
  }
}

/** 提示框队列 */
class TooltipQueue {
  private list: ViewItem[] = [];

  getViewItem(name: string): ViewItem {
    return this.list.find(v => v.viewName === name);
  }

  /**
   * 添加提示框
   * @param viewItem 
   * @param data 
   * @returns 
   */
  push(viewItem: ViewItem, data?: any) {
    if (!viewItem) return;
    viewItem.show(data);
    this.list.push(viewItem);
  }

  /**
   * 移除提示框
   * @param viewItem 
   * @param data 
   * @returns 
   */
  remove(viewItem: ViewItem, data?: any) {
    if (!viewItem) return;
    viewItem.close(data);
    this.list.splice(this.list.indexOf(viewItem), 1);
  }
}

/** 视图管理绑定组件 */
@ccclass('uim.ViewManager')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/viewmanager')
@executeInEditMode
@menu('BriefToolkit/UIM/ViewManager')
export class ViewManager extends Component implements IViewManager {
  @property({
    type: Node,
    tooltip: "视图内容节点",
  })
  private viewContent: Node = null;

  //#region 默认视图
  @property
  private _defaultView: string = "";
  private _viewEnums: { name: string, value: number }[] = [];
  private _defaultViewIndex = 0;
  @property({
    type: Enum({}),
    tooltip: "默认视图（启动默认加载）",
  })
  get defaultView() {
    return this._defaultViewIndex;
  }
  private set defaultView(value: number) {
    this._defaultViewIndex = value;
    if (this._viewEnums[value]) {
      this._defaultView = this._viewEnums[value].name
    }
  }
  //#endregion

  //#region 默认消息框
  @property
  private _defaultMessageBox: string = "";
  private _messageBoxEnums: { name: string, value: number }[] = [];
  private _defaultMessageBoxIndex = 0;
  @property({
    type: Enum({}),
    tooltip: "默认消息框",
  })
  get defaultMessageBox() {
    return this._defaultMessageBoxIndex;
  }
  set defaultMessageBox(value: number) {
    this._defaultMessageBoxIndex = value;
    if (this._messageBoxEnums[value]) {
      this._defaultMessageBox = this._messageBoxEnums[value].name
    }
  }
  //#endregion

  //#region 默认提示框
  @property
  private _defaultTooltip: string = "";
  private _tooltipEnums: { name: string, value: number }[] = [];
  private _defaultTooltipIndex = 0;
  @property({
    type: Enum({}),
    tooltip: "默认提示框",
  })
  get defaultTooltip() {
    return this._defaultTooltipIndex;
  }
  set defaultTooltip(value: number) {
    this._defaultTooltipIndex = value;
    if (this._tooltipEnums[value]) {
      this._defaultTooltip = this._tooltipEnums[value].name
    }
  }
  //#endregion

  @property([Prefab])
  private _viewList: Prefab[] = [];
  @property({
    type: [Prefab],
    tooltip: "视图预制体列表",
  })
  get viewList(): Prefab[] {
    return this._viewList;
  }
  set viewList(value: Prefab[]) {
    this._viewList = value;
    this.updateEditorDefaultView();
  }

  @property([Prefab])
  private _messageBoxList: Prefab[] = [];
  @property({
    type: [Prefab],
    tooltip: "消息框预制体列表",
  })
  get messageBoxList(): Prefab[] {
    return this._messageBoxList;
  }
  set messageBoxList(value: Prefab[]) {
    this._messageBoxList = value;
    this.updateEditorDefaultMessageBox();
  }

  @property([Prefab])
  private _tooltipList: Prefab[] = [];
  @property({
    type: [Prefab],
    tooltip: "消息框预制体列表",
  })
  get tooltipList(): Prefab[] {
    return this._tooltipList;
  }
  set tooltipList(value: Prefab[]) {
    this._tooltipList = value;
    this.updateEditorDefaultTooltip();
  }

  private viewTemplateMap: Map<string, { viewType: ViewType, node: Prefab | Node }> =
    new Map<string, { viewType: ViewType, node: Prefab | Node }>();

  private viewStack: ViewStack = new ViewStack();
  private messageBoxArray: MessageBoxQueue = new MessageBoxQueue();
  private tooltipArray: TooltipQueue = new TooltipQueue();

  //#region EDITOR

  // onRestore() {}

  private updateEditorDefaultView(): void {
    const newEnums = [];
    let index = 0;
    // 添加默认空项
    newEnums.push({ name: NullDefaultView, value: index++ });
    for (let viewPrefab of this._viewList) {
      if (viewPrefab == null) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        newEnums.push({ name: viewBase.viewName, value: index++ });
      }
    }
    this._viewEnums = newEnums;
    // 更新默认视图
    CCClass.Attr.setClassAttr(this, 'defaultView', 'enumList', newEnums);

    // 设置默认值
    if (this._defaultView !== "") {
      const index = this._viewEnums.findIndex(v => v.name === this._defaultView);
      if (index != -1) {
        this._defaultViewIndex = index;
        return;
      }
    }
    this._defaultViewIndex = 0;
  }

  private updateEditorDefaultMessageBox(): void {
    const newEnums = [];
    let index = 0;
    for (let viewPrefab of this._messageBoxList) {
      if (viewPrefab == null) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        newEnums.push({ name: viewBase.viewName, value: index++ });
      }
    }
    this._messageBoxEnums = newEnums;
    // 更新默认视图
    CCClass.Attr.setClassAttr(this, 'defaultMessageBox', 'enumList', newEnums);

    // 设置默认值
    if (this._defaultMessageBox !== "") {
      const index = this._messageBoxEnums.findIndex(v => v.name === this._defaultMessageBox);
      if (index != -1) {
        this._defaultMessageBoxIndex = index;
        return;
      }
    }
    this._defaultMessageBoxIndex = 0;
    if (this._messageBoxEnums.length > 0) {
      this._defaultMessageBox = this._messageBoxEnums[0].name;
    }
  }

  private updateEditorDefaultTooltip(): void {
    const newEnums = [];
    let index = 0;
    for (let viewPrefab of this._tooltipList) {
      if (viewPrefab == null) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        newEnums.push({ name: viewBase.viewName, value: index++ });
      }
    }
    this._tooltipEnums = newEnums;
    // 更新默认视图
    CCClass.Attr.setClassAttr(this, 'defaultTooltip', 'enumList', newEnums);

    // 设置默认值
    if (this._defaultTooltip !== "") {
      const index = this._tooltipEnums.findIndex(v => v.name === this._defaultTooltip);
      if (index != -1) {
        this._defaultTooltipIndex = index;
        return;
      }
    }
    this._defaultTooltipIndex = 0;
    if (this._tooltipEnums.length > 0) {
      this._defaultTooltip = this._tooltipEnums[0].name;
    }
  }

  //#endregion

  protected onLoad(): void {
    if (EDITOR) {
      this.updateEditorDefaultView();
      this.updateEditorDefaultMessageBox();
      this.updateEditorDefaultTooltip();
      return;
    }

    this.bindViewManager();

    // 预制体添加到模板表
    for (let viewPrefab of this._viewList) {
      if (!viewPrefab) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        this.viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: viewPrefab });
      }
    }
    for (let viewPrefab of this._messageBoxList) {
      if (!viewPrefab) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        this.viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: viewPrefab });
      }
    }
    for (let viewPrefab of this._tooltipList) {
      if (!viewPrefab) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        this.viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: viewPrefab });
      }
    }

    // 默认添加ViewContent子节点中为ViewBase的视图
    if (this.viewContent) {
      for (let node of this.viewContent.children) {
        this.registerView(node);
      }
    }

    // 显示默认视图
    if (this._defaultView !== NullDefaultView) {
      this.show(this._defaultView);
    }
  }

  //#region 绑定 ViewManager 供 View, MessageBox, Tooltip 调用
  private bindViewManager() {
    Views.bind(this);
    MessageBox.bind(this);
    Tooltip.bind(this);
  }

  private unbindViewManager() {
    Views.unbind(this);
    MessageBox.unbind(this);
    Tooltip.unbind(this);
  }

  protected onEnable(): void {
    this.bindViewManager();
  }

  protected onDisable(): void {
    this.unbindViewManager();
  }
  //#endregion

  private createViewItem(name: string): ViewItem {
    if (!name) return null;

    let viewTemplate = this.viewTemplateMap.get(name);
    if (!viewTemplate) return null;

    let viewItem: ViewItem = null;
    if (viewTemplate.node instanceof Prefab) {
      let newViewNode = instantiate(viewTemplate.node);
      let newViewBase = newViewNode.getComponent(ViewBase);
      this.viewContent.addChild(newViewNode);

      // 如果是缓存模式则重置模板为节点模板，下次直接使用节点模板
      if (newViewBase.isCache) {
        viewTemplate.node = newViewNode;
        viewTemplate.viewType = newViewBase.viewType;
        viewItem = new ViewItem(newViewBase, this.close.bind(this), this.backView.bind(this));
      }
      else {
        viewItem = new ViewItem(newViewBase, this.close.bind(this), this.backView.bind(this));
      }
    }
    else {
      const viewBase = viewTemplate.node.getComponent(ViewBase);
      viewItem = new ViewItem(viewBase, this.close.bind(this), this.backView.bind(this));
    }

    return viewItem;
  }

  /**
   * 更新视图在父类数组中的位置
   * Unknown < View < MessageBox < Tooltip
   */
  private updateContentSiblingIndex(): void {
    let viewSortArray: ViewSort[] = [];
    let childCount = this.viewContent.children.length;
    // 先设置 Unknown 节点的排序索引
    let siblingIndex = 0;
    for (let i = 0; i < childCount; i++) {
      let child = this.viewContent.children[i];
      let viewSort = child.getComponent(ViewSort);
      if (viewSort) {
        viewSortArray.push(viewSort);
      }
      else {
        child.setSiblingIndex(siblingIndex);
        siblingIndex++;
      }
    }
    // 对 ViewSort 组件的节点按照 sortIndex 进行排序
    viewSortArray.sort((a, b) => {
      return a.sortIndex - b.sortIndex;
    });
    // 更新节点顺序, ViewSort 组件的节点在 Unknown 节点之后，按照 sortIndex 顺序排列
    for (let i = 0; i < viewSortArray.length; i++) {
      let viewSort = viewSortArray[i];
      if (viewSort.node.parent) {
        viewSort.node.setSiblingIndex(i + siblingIndex);
      }
    }
  }

  /**
   * 获取视图类型
   * @param name 视图名称
   * @returns 视图类型
   */
  getViewType(name: string): ViewType {
    let viewTemplate = this.viewTemplateMap.get(name);
    if (viewTemplate) {
      return viewTemplate.viewType;
    }
    return null;
  }

  /**
   * 检查视图是否存在
   * @param name 视图名称
   * @param type 视图类型
   * @returns 
   */
  checkView(name: string, type?: ViewType): boolean {
    let viewTemplate = this.viewTemplateMap.get(name);
    if (!viewTemplate) return false;
    if (type && viewTemplate.viewType != type) return false;
    return true;
  }

  /**
   * 获取所有视图名称（模板表中的视图）
   * @returns 所有视图名称
   */
  getAllViewNames(): string[] {
    let names: string[] = [];
    for (let [name, value] of this.viewTemplateMap) {
      if (value.viewType == ViewType.View) {
        names.push(name);
      }
    }
    return names;
  }

  //#region registerView and unregisterView
  /**
   * 注册视图
   * @param prefab 视图预制体（需要挂载ViewBase组件）
   */
  registerView(prefab: Prefab): boolean;
  /**
   * 注册视图
   * @param viewBaseNode 视图节点(节点需要挂载ViewBase组件) 
   */
  registerView(viewBaseNode: Node): boolean;
  /**
   * 注册视图
   * @param name 视图名称
   * @param node 视图节点
   * @param type 视图类型, 默认 ViewType.View
   */
  registerView(name: string, node: Node, type?: ViewType): boolean;
  registerView(...args: any[]): boolean {
    const [nameOrNode, node, type] = args;
    if (nameOrNode instanceof Prefab) {
      let viewBase: ViewBase = nameOrNode.data.getComponent(ViewBase);
      if (viewBase) {
        this.viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: nameOrNode });
        return true;
      }
      else {
        return false;
      }
    }
    else if (nameOrNode instanceof Node) {
      let viewBase: ViewBase = nameOrNode.getComponent(ViewBase);
      if (viewBase) {
        viewBase.node.active = false;
        this.viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: nameOrNode });
        return true;
      }
      else {
        return false;
      }
    }
    else {
      if (!nameOrNode || typeof nameOrNode !== "string") return false;
      if (!node || !(node instanceof Node)) return false;

      let viewBase = node.getComponent(ViewBase);
      if (!viewBase) {
        viewBase = node.addComponent(ViewBase);
      }
      viewBase.viewName = nameOrNode;
      viewBase.viewType = type || ViewType.View;
      viewBase.isCache = true;

      this.viewTemplateMap.set(nameOrNode, { viewType: viewBase.viewType, node: node });
      return true;
    }
  }

  /**
   * 注销视图
   * @param name 视图名称 
   */
  unregisterView(name: string): void {
    this.viewTemplateMap.delete(name);
  }
  //#endregion

  /**
   * 显示视图
   * @param name 视图名称
   * @param data 数据
   */
  show(name: string, data?: any): void {
    let viewType = this.getViewType(name);
    if (viewType == null) return;
    switch (viewType) {
      case ViewType.View:
        this.showView(name, data);
        break;
      case ViewType.MessageBox:
        this.showMessageBox(name, data);
        break;
      case ViewType.Tooltip:
        this.showTooltip(name, data);
        break;
      default:
        break;
    }
  }

  /**
   * 关闭视图
   * @param name 视图名称
   * @param data 数据
   */
  close(name: string, data?: any): void {
    let viewType = this.getViewType(name);
    if (viewType == null) return;
    switch (viewType) {
      case ViewType.View:
        this.closeView(name, data);
        break;
      case ViewType.MessageBox:
        this.closeMessageBox(name, data);
        break;
      case ViewType.Tooltip:
        this.closeTooltip(name, data);
        break;
      default:
        break;
    }
  }

  //#region View show and close

  /**
   * 是否是当前显示的最上层视图
   * @param name 视图名称
   * @returns 是否是当前显示的最上层视图
   */
  isTopView(name: string): boolean {
    return this.viewStack.isTop(name);
  }

  /** 获取当前显示的最上层视图名称 */
  getCurrentViewName(): string {
    if (this.viewStack) {
      const viewItem = this.viewStack.getTopViewItem();
      if (viewItem) {
        return viewItem.viewName;
      }
    }
    return null;
  }

  /**
   * 显示视图（该视图已经存在则关闭之前所有视图显示该视图）
   * @param name 视图名称(不填显示默认视图) 
   * @param data 数据
   */
  showView(name: string, data?: any): void {
    if (!this.checkView(name, ViewType.View)) return;

    // 使用延迟，防止在onLoad中调用
    this.scheduleOnce(() => {
      if (this.viewStack.popTo(name, data)) {
        return;
      }
      else {
        let viewItem = this.createViewItem(name);
        if (!viewItem) return;
        this.viewStack.push(viewItem, data);
        this.updateContentSiblingIndex();
      }
    }, 0);
  }

  /**
   * 显示视图并替换当前视图（该视图已经存在则取出该视图显示替换）
   * @param name 视图名称
   * @param data 数据
   */
  showAsReplace(name: string, data?: any): void {
    if (!this.checkView(name, ViewType.View)) return;

    // 使用延迟，防止在onLoad中调用
    this.scheduleOnce(() => {
      let viewItem = this.viewStack.detach(name);
      if (!viewItem) {
        viewItem = this.createViewItem(name);
        if (!viewItem) return;
      }
      this.viewStack.replaceTop(viewItem, data);
      this.updateContentSiblingIndex();
    }, 0);
  }

  /**
   * 显示视图做为根视图（该视图已经存在则取出该视图做为根视图）
   * @param name 视图名称
   * @param data 数据
   */
  showAsRoot(name: string, data?: any): void {
    if (!this.checkView(name, ViewType.View)) return;

    // 使用延迟，防止在onLoad中调用
    this.scheduleOnce(() => {
      let viewItem = this.viewStack.detach(name);
      if (!viewItem) {
        viewItem = this.createViewItem(name);
        if (!viewItem) return;
      }
      this.viewStack.setAsRoot(viewItem, data);
      this.updateContentSiblingIndex();
    }, 0);
  }

  /**
   * 视图后退（返回上一个显示的视图）
   * @param data 数据
   */
  backView(data?: any): void {
    this.viewStack.pop(data);
  }

  /**
   * 关闭视图
   * @param name 视图名称
   * @param data 数据
   */
  closeView(name: string, data?: any): void {
    if (!this.checkView(name, ViewType.View)) return;
    this.viewStack.remove(name, data);
  }
  //#endregion

  //#region MessageBox show and close
  /**
   * 显示消息框
   * @param data 数据
   */
  showMessageBox(data: any): boolean;
  /**
   * 显示消息框
   * @param name 消息框名称(不填显示默认消息框)
   * @param data 数据
   */
  showMessageBox(name: string, data: any): boolean;
  showMessageBox(...args: any[]): boolean {
    let name: string;
    let data: any;
    if (args.length == 1) {
      data = args[0];
    }
    else {
      name = args[0];
      data = args[1];
    }

    if (!name) name = this._defaultMessageBox;
    if (!this.checkView(name, ViewType.MessageBox)) {
      return false;
    }

    // 重复消息框，只更新数据
    let viewItem = this.messageBoxArray.getViewItem(name);
    if (viewItem) {
      viewItem.data(data);
      return true;
    }

    viewItem = this.createViewItem(name);
    if (!viewItem) {
      return false;
    }

    this.messageBoxArray.push(viewItem, data);
    this.updateContentSiblingIndex();
    return true;
  }

  /**
   * 关闭消息框
   * @param name 消息框名称(不填关闭默认消息框)
   * @param data 数据
   */
  closeMessageBox(name?: string, data?: any): void {
    if (!name) name = this._defaultMessageBox;
    if (!this.checkView(name, ViewType.MessageBox)) return;

    let viewItem = this.messageBoxArray.getViewItem(name);
    if (viewItem) {
      this.messageBoxArray.remove(viewItem, data);
    }
  }
  //#endregion

  //#region Tooltip show and close
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
  showTooltip(...args: any[]): boolean {
    let name: string;
    let data: any;
    if (args.length == 1) {
      data = args[0];
    }
    else {
      name = args[0];
      data = args[1];
    }

    if (!name) name = this._defaultTooltip;
    if (!this.checkView(name, ViewType.Tooltip)) {
      return false;
    }

    // 重复提示框，只更新数据
    let viewItem = this.tooltipArray.getViewItem(name);
    if (viewItem) {
      viewItem.data(data);
      return true;
    }

    viewItem = this.createViewItem(name);
    if (!viewItem) {
      return false;
    }

    this.tooltipArray.push(viewItem, data);
    this.updateContentSiblingIndex();
    return true;
  }

  /**
   * 关闭提示框
   * @param name 提示框名称(不填关闭默认提示框)
   * @param data 数据
   */
  closeTooltip(name?: string, data?: any): void {
    if (!name) name = this._defaultTooltip;
    if (!this.checkView(name, ViewType.Tooltip)) return;

    let viewItem = this.tooltipArray.getViewItem(name);
    if (viewItem) {
      this.tooltipArray.remove(viewItem, data);
    }
  }
  //#endregion

}
