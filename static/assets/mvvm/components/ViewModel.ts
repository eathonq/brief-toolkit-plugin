/**
 * ViewModel.ts - 视图模型绑定组件
 * @description 该组件用于管理视图模型的数据绑定和生命周期。
 * @important 在 Cocos Creator 中，通常挂载在预制体根节点上。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/mvvm/viewmodel}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-03-02
 * @modified 2026-03-11
 */

import { _decorator, Enum, CCClass, Node } from "cc";
import { EDITOR } from "cc/env";
import { reactive } from "../core/Reactive";
import { DataContext } from "./DataContext";
import { decoratorData } from "../core/DecoratorData";
import { IViewModel } from "../";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/**
 * 视图模型绑定组件
 * 管理视图模型的数据绑定和生命周期，一般需要挂载在根节点或者顶级节点上。
 */
@ccclass("mvvm.ViewModel")
@help("https://vangagh.gitbook.io/brief-toolkit/mvvm/viewmodel")
@executeInEditMode
@menu("BriefToolkit/Mvvm/ViewModel")
export class ViewModel extends DataContext {

  private get viewModelData(): IViewModel | null {
    return this._data as IViewModel | null;
  }

  @property
  protected _viewModelName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  get viewModelName() {
    return this._viewModelName;
  }

  protected _viewModelEnums: { name: string, value: number }[] = [];
  private _viewModel = 0;
  @property({
    type: Enum({}),
    tooltip: "视图模型",
  })
  get viewModel() {
    return this._viewModel;
  }

  private resolveViewModelIndex(value: number): number {
    if (!Number.isInteger(value)) {
      return 0;
    }
    if (value < 0 || value >= this._viewModelEnums.length) {
      return 0;
    }
    return value;
  }

  set viewModel(value) {
    const safeIndex = this.resolveViewModelIndex(value);
    this._viewModel = safeIndex;

    // 相关本地数据保存
    if (this._viewModelEnums[safeIndex]) {
      this._viewModelName = this._viewModelEnums[safeIndex].name;
      this.bindingType = this._viewModelName;
      this.path = this.bindingType;
    }
    else {
      this._viewModelName = "";
      this.bindingType = "";
      this.path = "";
    }
  }

  //#region EDITOR
  onRestore() {
    this.checkEditorComponent();
  }

  protected checkEditorComponent() {
    this.updateEditorViewModelEnums();
  }

  private updateEditorViewModelEnums() {
    // 设置绑定属性
    const newEnums: { name: string, value: number }[] = [];
    const dataList = decoratorData.getViewModelList(this.node.name);
    if (dataList) {
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        newEnums.push({ name: data.name, value: i });
      }
    }
    // 更新绑定数据枚举
    this._viewModelEnums = newEnums;
    CCClass.Attr.setClassAttr(this, "viewModel", "enumList", newEnums);

    // 如果绑定数据枚举为空，则警告
    if (newEnums.length === 0) {
      console.warn(`PATH ${this.getNodePath()} 组件 ViewModel 绑定未找到合适的数据。`);
    }

    // 设置绑定数据枚举默认值
    if (this._viewModelName !== "") {
      const findIndex = newEnums.findIndex((item) => { return item.name === this._viewModelName });
      if (findIndex !== -1) {
        this.viewModel = findIndex;
        return;
      }
    }
    this.viewModel = 0;
  }

  //#endregion

  protected onLoad() {
    // 根节点
    this.isRoot = true;

    super.onLoad();
    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    // 组件数据初始化
    this.onUpdateData();

    if (this._data) {
      ViewModelData.register(this._data, this._viewModelName, this.node);
    }

    // 下一帧执行，确保数据初始化完成
    this.scheduleOnce(() => {
      const data = this.viewModelData;
      data?.onLoaded?.call(data);
    });
  }

  protected onDestroy() {
    super.onDestroy();
    if (EDITOR) return;

    if (this._data) {
      ViewModelData.unregister(this._data);
      const data = this.viewModelData;
      data?.onDestroy?.call(data);
      this._data = null;
    }
  }

  protected update(dt: number) {
    if (EDITOR) return;

    const data = this.viewModelData;
    data?.onUpdate?.call(data, dt);
  }

  protected onUpdateData() {
    // 绑定数据设置
    this.parent = this;
    // 创建视图模型
    const vm = decoratorData.createInstance(this._viewModelName);
    if (!vm) {
      console.error(`ViewModel: ${this.node.name} onLoad createInstance is null`);
      return;
    }
    // 创建响应式视图模型
    const reactive_vm = reactive(vm);
    this._data = reactive_vm;
  }
}

/**
 * ViewModelData 静态类
 * 数据结构：Map<name, Map<target, Set<Node>>>
 * 通过 name 找到所有绑定的对象，每个对象关联一组节点
 */
export class ViewModelData {
  // name -> (target -> Set<Node>)
  private static _bindings = new Map<string, Map<object, Set<Node>>>();

  private constructor() { }

  /**
   * 注册绑定关系
   * @param target 目标对象
   * @param name ViewModel名称
   * @param node 关联节点
   */
  static register(target: object, name: string, node: Node): void {
    // 获取或创建 name 的映射
    let targetMap = this._bindings.get(name);
    if (!targetMap) {
      targetMap = new Map();
      this._bindings.set(name, targetMap);
    }

    // 获取或创建 target 的节点集合
    let nodes = targetMap.get(target);
    if (!nodes) {
      nodes = new Set();
      targetMap.set(target, nodes);
    }

    // 添加节点
    nodes.add(node);
  }

  /**
   * 取消注册（完全移除对象的所有绑定）
   */
  static unregister(target: object): void {
    for (const [name, targetMap] of this._bindings) {
      if (targetMap.has(target)) {
        targetMap.delete(target);

        // 如果 targetMap 为空，清理整个 name 条目
        if (targetMap.size === 0) {
          this._bindings.delete(name);
        }
      }
    }
  }

  /**
   * 通过名称获取第一个对象的第一个节点
   */
  static getFirstNode(name: string): Node | null {
    const targetMap = this._bindings.get(name);
    if (!targetMap) return null;

    const firstTarget = targetMap.keys().next().value;
    if (!firstTarget) return null;

    const nodes = targetMap.get(firstTarget);
    return nodes ? nodes.values().next().value || null : null;
  }

  /**
   * 通过名称和节点获取对应的对象
   */
  static getTargetByNode<T = any>(name: string, node: Node): T | null {
    const targetMap = this._bindings.get(name);
    if (!targetMap) return null;

    for (const [target, nodes] of targetMap) {
      if (nodes.has(node)) {
        return target as T;
      }
    }
    return null;
  }

  /**
   * 通过名称获取第一个对象
   */
  static getFirstTarget<T = any>(name: string): T | null {
    const targetMap = this._bindings.get(name);
    if (!targetMap) return null;

    const firstTarget = targetMap.keys().next().value;
    return firstTarget ? firstTarget as T : null;
  }

  /**
   * 通过类型获取第一个对象
   */
  static getFirstTargetByType<T>(ctor: { new(...args: any[]): T }): T | null {
    const name = decoratorData.getSafeTypeName(ctor);
    return this.getFirstTarget<T>(name);
  }

  /**
   * 通过类型和节点获取对象
   */
  static getTargetByTypeAndNode<T>(ctor: { new(...args: any[]): T }, node: Node): T | null {
    const name = decoratorData.getSafeTypeName(ctor);
    return this.getTargetByNode<T>(name, node);
  }

  /**
   * 获取对象绑定的所有节点
   */
  static getNodes(target: object): Node[] {
    const nodes: Node[] = [];

    for (const targetMap of this._bindings.values()) {
      const targetNodes = targetMap.get(target);
      if (targetNodes) {
        nodes.push(...targetNodes);
      }
    }

    return nodes;
  }

  /**
   * 获取对象在指定名称下绑定的节点
   */
  static getNodesByName(target: object, name: string): Node[] {
    const targetMap = this._bindings.get(name);
    if (!targetMap) return [];

    const nodes = targetMap.get(target);
    return nodes ? Array.from(nodes) : [];
  }

  /**
   * 获取指定名称的所有对象
   */
  static getAllTargets<T = any>(name: string): T[] {
    const targetMap = this._bindings.get(name);
    if (!targetMap) return [];

    return Array.from(targetMap.keys()) as T[];
  }

  /**
   * 判断对象是否有绑定
   */
  static hasTarget(target: object): boolean {
    for (const targetMap of this._bindings.values()) {
      if (targetMap.has(target)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 判断指定名称下是否有指定对象的绑定
   */
  static hasTargetByName(target: object, name: string): boolean {
    const targetMap = this._bindings.get(name);
    return targetMap ? targetMap.has(target) : false;
  }

  /**
   * 判断指定名称下是否有指定节点的绑定
   */
  static hasNode(name: string, node: Node): boolean {
    const targetMap = this._bindings.get(name);
    if (!targetMap) return false;

    for (const nodes of targetMap.values()) {
      if (nodes.has(node)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取节点绑定的第一个对象（不考虑名称）
   */
  static getTargetByNodeOnly<T = any>(node: Node): T | null {
    for (const targetMap of this._bindings.values()) {
      for (const [target, nodes] of targetMap) {
        if (nodes.has(node)) {
          return target as T;
        }
      }
    }
    return null;
  }

  /**
   * 获取节点绑定的所有对象（不考虑名称）
   */
  static getAllTargetsByNodeOnly<T = any>(node: Node): T[] {
    const targets: T[] = [];

    for (const targetMap of this._bindings.values()) {
      for (const [target, nodes] of targetMap) {
        if (nodes.has(node)) {
          targets.push(target as T);
        }
      }
    }

    return targets;
  }

  /**
   * 获取绑定统计信息
   */
  static getStats() {
    let totalTargets = 0;
    let totalNodes = 0;

    for (const targetMap of this._bindings.values()) {
      totalTargets += targetMap.size;
      for (const nodes of targetMap.values()) {
        totalNodes += nodes.size;
      }
    }

    return {
      names: this._bindings.size,
      targets: totalTargets,
      nodes: totalNodes
    };
  }

  /**
   * 清理所有绑定
   */
  static clear(): void {
    this._bindings.clear();
  }
}