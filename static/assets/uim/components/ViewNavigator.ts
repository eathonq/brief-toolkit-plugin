/**
 * ViewNavigator.ts - 场景级视图导航组件
 * @description 每场景独立挂载，管理该场景的视图导航（ViewStack / MessageBoxQueue / TooltipQueue）。
 *              实现 IViewManager 接口，通过 __viewsBind() 注册为当前场景的视图管理器。
 * @important 在 Cocos Creator 中，每个场景根节点挂载一个 ViewNavigator。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/uim/viewmanager}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 * 
 * @created 2023-01-30
 * @modified 2026-06-11
 */

import { _decorator, Node, Component, Prefab, instantiate, Enum, CCClass } from 'cc';
import { EDITOR } from 'cc/env';
import { IViewManager, ViewEvent, ViewState, ViewType } from '../core/IViewManager';
import { ViewBase } from './ViewBase';
import { Views, __viewsBind, __viewsUnbind } from '../core/Views';
import { ViewSort } from './ViewSort';

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

const NullDefaultView = "NULL";

/** 视图项 */
class ViewItem {
  /** 视图状态 */
  private _state: ViewState = ViewState.Hide;
  /** 视图状态 */
  get state() {
    return this._state;
  }

  /** 视图基础数据 */
  private _viewBase: ViewBase = null!;
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
      this._viewBase.setCloseHandler(doClose);
    }
    if (doBack) {
      this._viewBase.setBackHandler(doBack);
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
  private _list: ViewItem[] = [];

  getViewItem(name: string): ViewItem {
    return this._list.find(v => v.viewName === name);
  }

  getTopViewItem(): ViewItem {
    if (this._list.length == 0) return null;
    return this._list[this._list.length - 1];
  }

  isTop(name: string): boolean {
    if (this._list.length == 0) return false;
    const topView = this._list[this._list.length - 1];
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
    if (this._list.length > 0) {
      const current = this._list[this._list.length - 1];
      current.hide();
    }

    //添加到当前最后一个视图，并显示
    this._list.push(viewItem);
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
    if (this._list.length > 0) {
      const current = this._list.pop();
      current.close();
    }

    //添加到当前最后一个视图，并显示
    this._list.push(viewItem);
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
    while (this._list.length > 0) {
      const current = this._list.pop();
      current.close();
    }

    //添加到当前最后一个视图，并显示
    this._list.push(viewItem);
    viewItem.show(data);
  }

  /**
   * 弹出栈顶（最后一个视图）
   * @param data 数据
   * @param isRemove 是否移除（传递的数据给到移除的视图）
   */
  pop(data?: any, isRemove = false): void {
    // 关闭当前最后一个视图
    if (this._list.length > 0) {
      const current = this._list.pop();
      current.close(isRemove ? data : null);
    }

    // 显示当前最后一个视图
    if (this._list.length > 0) {
      const showView = this._list[this._list.length - 1];
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

    const index = this._list.findIndex(v => v.viewName === name);
    if (index != -1) {
      // 已经是当前视图，不需要再操作
      if (index == this._list.length - 1) return true;

      // 关闭前面所有的视图
      while (this._list.length > index + 1) {
        const closeView = this._list.pop();
        closeView.close();
      }

      // 显示当前最后一个视图
      if (this._list.length > 0) {
        const showView = this._list[this._list.length - 1];
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
    const index = this._list.findIndex(v => v.viewName === name);
    if (index != -1) {
      // 最后一个视图，弹出
      if (index == this._list.length - 1) return this.pop(data, true);

      // 不是最后一个视图，直接关闭
      const closeView = this._list.splice(index, 1);
      closeView[0].close(data);
    }
  }

  /**
   * 分离指定视图（从栈中移除但不执行任何生命周期操作，显示、关闭、隐藏等）
   * @param name 视图名称
   * @returns 视图信息
   */
  detach(name: string) {
    const index = this._list.findIndex(v => v.viewName === name);
    if (index != -1) {
      // 不是最后一个视图，直接分离
      return this._list.splice(index, 1)[0];
    }
    return null;
  }
}

/** 消息框队列 */
class MessageBoxQueue {
  private _list: ViewItem[] = [];

  getViewItem(name: string): ViewItem {
    return this._list.find(v => v.viewName === name);
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
    this._list.push(viewItem);
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
    this._list.splice(this._list.indexOf(viewItem), 1);
  }
}

/** 提示框队列 */
class TooltipQueue {
  private _list: ViewItem[] = [];

  getViewItem(name: string): ViewItem {
    return this._list.find(v => v.viewName === name);
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
    this._list.push(viewItem);
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
    this._list.splice(this._list.indexOf(viewItem), 1);
  }
}

/** 场景级视图导航组件 */
@ccclass('uim.ViewNavigator')
@help('https://vangagh.gitbook.io/brief-toolkit/uim/viewnavigator')
@executeInEditMode
@menu('BriefToolkit/UIM/ViewNavigator')
export class ViewNavigator extends Component implements IViewManager {
  @property({ type: Node, tooltip: "视图内容节点" })
  private viewContent: Node = null!;

  //#region 默认视图
  @property
  private _defaultView: string = "";
  private _viewEnums: { name: string, value: number }[] = [];
  private _defaultViewIndex = 0;
  @property({ type: Enum({}), tooltip: "默认视图（启动默认加载）" })
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
  @property({ type: Enum({}), tooltip: "默认消息框" })
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
  @property({ type: Enum({}), tooltip: "默认提示框" })
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
  @property({ type: [Prefab], tooltip: "视图预制体列表" })
  get viewList(): Prefab[] {
    return this._viewList;
  }
  set viewList(value: Prefab[]) {
    this._viewList = value;
    this._updateEditorDefaultView();
  }

  @property([Prefab])
  private _messageBoxList: Prefab[] = [];
  @property({ type: [Prefab], tooltip: "消息框预制体列表" })
  get messageBoxList(): Prefab[] {
    return this._messageBoxList;
  }
  set messageBoxList(value: Prefab[]) {
    this._messageBoxList = value;
    this._updateEditorDefaultMessageBox();
  }

  @property([Prefab])
  private _tooltipList: Prefab[] = [];
  @property({ type: [Prefab], tooltip: "提示框预制体列表" })
  get tooltipList(): Prefab[] {
    return this._tooltipList;
  }
  set tooltipList(value: Prefab[]) {
    this._tooltipList = value;
    this._updateEditorDefaultTooltip();
  }

  private _viewTemplateMap: Map<string, { viewType: ViewType, node: Prefab | Node }> =
    new Map<string, { viewType: ViewType, node: Prefab | Node }>();

  private _viewStack: ViewStack = new ViewStack();
  private _messageBoxArray: MessageBoxQueue = new MessageBoxQueue();
  private _tooltipArray: TooltipQueue = new TooltipQueue();

  //#region EDITOR

  // onRestore() {}

  private _updateEditorDefaultView(): void {
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

  private _updateEditorDefaultMessageBox(): void {
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

  private _updateEditorDefaultTooltip(): void {
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
      this._updateEditorDefaultView();
      this._updateEditorDefaultMessageBox();
      this._updateEditorDefaultTooltip();
      return;
    }

    this._bindNavigator();

    // 预制体添加到模板表
    for (let viewPrefab of this._viewList) {
      if (!viewPrefab) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        this._viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: viewPrefab });
      }
    }
    for (let viewPrefab of this._messageBoxList) {
      if (!viewPrefab) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        this._viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: viewPrefab });
      }
    }
    for (let viewPrefab of this._tooltipList) {
      if (!viewPrefab) continue;
      let viewBase: ViewBase = viewPrefab.data.getComponent(ViewBase);
      if (viewBase) {
        this._viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: viewPrefab });
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

  //#region 绑定 ViewNavigator 供 View, MessageBox, Tooltip 调用
  // MessageBox 与 Tooltip 通过 Views.current 间接访问，
  // 确保三者始终指向同一个 ViewNavigator 实例，避免绑定不一致。
  private _bindNavigator() {
    __viewsBind(this);
  }

  private _unbindNavigator() {
    __viewsUnbind(this);
  }

  protected onEnable(): void {
    this._bindNavigator();
  }

  protected onDisable(): void {
    this._unbindNavigator();
  }
  //#endregion

  private _createViewItem(name: string): ViewItem {
    if (!name) return null;

    let viewTemplate = this._viewTemplateMap.get(name);
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
  private _updateContentSiblingIndex(): void {
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
  getViewType<T extends string = string>(name: T): ViewType {
    let viewTemplate = this._viewTemplateMap.get(name);
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
  checkView<T extends string = string>(name: T, type?: ViewType): boolean {
    let viewTemplate = this._viewTemplateMap.get(name);
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
    for (let [name, value] of this._viewTemplateMap) {
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
        this._viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: nameOrNode });
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
        this._viewTemplateMap.set(viewBase.viewName, { viewType: viewBase.viewType, node: nameOrNode });
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

      this._viewTemplateMap.set(nameOrNode, { viewType: viewBase.viewType, node: node });
      return true;
    }
  }

  /**
   * 注销视图
   * @param name 视图名称 
   */
  unregisterView(name: string): void {
    this._viewTemplateMap.delete(name);
  }
  //#endregion

  /**
   * 显示视图
   * @param name 视图名称
   * @param data 数据
   */
  show<T extends string = string>(name: T, data?: any): void {
    let viewType = this.getViewType(name);
    if (viewType == null) {
      Views.onError?.(name, `View "${name}" not registered`);
      return;
    }
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
  close<T extends string = string>(name: T, data?: any): void {
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
  isTopView<T extends string = string>(name: T): boolean {
    return this._viewStack.isTop(name);
  }

  /** 获取当前显示的最上层视图名称 */
  getCurrentViewName(): string {
    if (this._viewStack) {
      const viewItem = this._viewStack.getTopViewItem();
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
  showView<T extends string = string>(name: T, data?: any): void {
    if (!this.checkView(name, ViewType.View)) {
      Views.onError?.(name, `View "${name}" not registered or wrong type (expected View)`);
      return;
    }

    // 使用微任务延迟，防止在onLoad中调用，同时保证同帧内调用顺序确定
    Promise.resolve().then(() => {
      if (this._viewStack.popTo(name, data)) {
        return;
      }
      else {
        let viewItem = this._createViewItem(name);
        if (!viewItem) {
          Views.onError?.(name, `Failed to instantiate view "${name}" from template`);
          return;
        }
        this._viewStack.push(viewItem, data);
        this._updateContentSiblingIndex();
      }
    });
  }

  /**
   * 显示视图并替换当前视图（该视图已经存在则取出该视图显示替换）
   * @param name 视图名称
   * @param data 数据
   */
  showAsReplace<T extends string = string>(name: T, data?: any): void {
    if (!this.checkView(name, ViewType.View)) {
      Views.onError?.(name, `View "${name}" not registered or wrong type (expected View)`);
      return;
    }

    // 使用微任务延迟，防止在onLoad中调用，同时保证同帧内调用顺序确定
    Promise.resolve().then(() => {
      let viewItem = this._viewStack.detach(name);
      if (!viewItem) {
        viewItem = this._createViewItem(name);
        if (!viewItem) {
          Views.onError?.(name, `Failed to instantiate view "${name}" from template`);
          return;
        }
      }
      this._viewStack.replaceTop(viewItem, data);
      this._updateContentSiblingIndex();
    });
  }

  /**
   * 显示视图做为根视图（该视图已经存在则取出该视图做为根视图）
   * @param name 视图名称
   * @param data 数据
   */
  showAsRoot<T extends string = string>(name: T, data?: any): void {
    if (!this.checkView(name, ViewType.View)) {
      Views.onError?.(name, `View "${name}" not registered or wrong type (expected View)`);
      return;
    }

    // 使用微任务延迟，防止在onLoad中调用，同时保证同帧内调用顺序确定
    Promise.resolve().then(() => {
      let viewItem = this._viewStack.detach(name);
      if (!viewItem) {
        viewItem = this._createViewItem(name);
        if (!viewItem) {
          Views.onError?.(name, `Failed to instantiate view "${name}" from template`);
          return;
        }
      }
      this._viewStack.setAsRoot(viewItem, data);
      this._updateContentSiblingIndex();
    });
  }

  /**
   * 视图后退（返回上一个显示的视图）
   * @param data 数据
   */
  backView(data?: any): void {
    this._viewStack.pop(data);
  }

  /**
   * 关闭视图
   * @param name 视图名称
   * @param data 数据
   */
  closeView<T extends string = string>(name: T, data?: any): void {
    if (!this.checkView(name, ViewType.View)) return;
    this._viewStack.remove(name, data);
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
  showMessageBox<T extends string = string>(name: T, data: any): boolean;
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
      Views.onError?.(name, `MessageBox "${name}" not registered or wrong type`);
      return false;
    }

    // 重复消息框，更新数据（已由 MessageBoxBase 内部处理）
    let viewItem = this._messageBoxArray.getViewItem(name);
    if (viewItem) {
      viewItem.data(data);
      return true;
    }

    viewItem = this._createViewItem(name);
    if (!viewItem) {
      Views.onError?.(name, `Failed to instantiate MessageBox "${name}" from template`);
      return false;
    }

    this._messageBoxArray.push(viewItem, data);
    this._updateContentSiblingIndex();
    return true;
  }

  /**
   * 关闭消息框
   * @param name 消息框名称(不填关闭默认消息框)
   * @param data 数据
   */
  closeMessageBox<T extends string = string>(name?: T, data?: any): void {
    const n = (name as string) || this._defaultMessageBox;
    if (!this.checkView(n, ViewType.MessageBox)) return;

    let viewItem = this._messageBoxArray.getViewItem(n);
    if (viewItem) {
      this._messageBoxArray.remove(viewItem, data);
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
  showTooltip<T extends string = string>(name: T, data: any): boolean;
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
      Views.onError?.(name, `Tooltip "${name}" not registered or wrong type`);
      return false;
    }

    // 重复提示框，更新数据
    let viewItem = this._tooltipArray.getViewItem(name);
    if (viewItem) {
      viewItem.data(data);
      return true;
    }

    viewItem = this._createViewItem(name);
    if (!viewItem) {
      Views.onError?.(name, `Failed to instantiate Tooltip "${name}" from template`);
      return false;
    }

    this._tooltipArray.push(viewItem, data);
    this._updateContentSiblingIndex();
    return true;
  }

  /**
   * 关闭提示框
   * @param name 提示框名称(不填关闭默认提示框)
   * @param data 数据
   */
  closeTooltip<T extends string = string>(name?: T, data?: any): void {
    const n = (name as string) || this._defaultTooltip;
    if (!this.checkView(n, ViewType.Tooltip)) return;

    let viewItem = this._tooltipArray.getViewItem(n);
    if (viewItem) {
      this._tooltipArray.remove(viewItem, data);
    }
  }
  //#endregion

}
