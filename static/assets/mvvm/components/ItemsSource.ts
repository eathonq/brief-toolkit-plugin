/**
 * ItemsSource.ts - 数据集合绑定组件
 * @description 该组件用于绑定上级数据中的集合数据到组件上，提供数据集合管理功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/mvvm/itemssource}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-03-02
 * @modified 2026-03-11
 */

import { _decorator, Node, instantiate, Enum, CCClass } from 'cc';
import { EDITOR } from 'cc/env';
import { reactive, watch, WatchHandle } from '../core/Reactive';
import { DataKind, decoratorData } from '../core/DecoratorData';
import { DataContext } from "./DataContext";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/** 
 * 数据集合绑定组件
 * 绑定上级数据中的集合数据到组件上
 */
@ccclass('mvvm.ItemsSource')
@help('https://vangagh.gitbook.io/brief-toolkit/mvvm/itemssource')
@executeInEditMode
@menu('BriefToolkit/Mvvm/ItemsSource')
export class ItemsSource extends DataContext {

  /** 
   * 获取绑定的数据
   * @param node 有挂载 ItemsSource 的节点
   */
  static Data<T = any>(node: Node): T {
    let context = node.getComponent(ItemsSource);
    if (!context) return null;
    return context._data as T;
  }

  @property({
    type: Node,
    tooltip: '模板节点',
  })
  private template: Node = null;

  @property
  private _isSelected: boolean = false;
  @property({
    tooltip: '是否绑定选中项',
  })
  get isSelected() {
    return this._isSelected;
  }
  private set isSelected(value) {
    this._isSelected = value;
    this.updateEditorBindingSelectedEnums();
  }

  @property({
    tooltip: '删除列表项时是否清空选中绑定',
    visible() {
      return this._isSelected;
    }
  })
  private clearSelectedOnDelete = true;

  @property
  private _bindingSelectedName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  private _bindingSelectedEnums: { name: string, value: number }[] = [];
  private _bindingSelected = 0;
  /** 绑定选中项 */
  @property({
    type: Enum({}),
    tooltip: '绑定选中项',
    visible() {
      return this._isSelected;
    }
  })
  get bindingSelected() {
    return this._bindingSelected;
  }
  private set bindingSelected(value) {
    this._bindingSelected = value;
    if (this._bindingSelectedEnums[value]) {
      this._bindingSelectedName = this._bindingSelectedEnums[value].name;
    }
  }

  //#region EDITOR

  private updateEditorBindingSelectedEnums() {
    if (!this._isSelected) return;
    if (!this.parent) return;

    // 获取绑定属性
    const newEnums = [];
    const dataList = decoratorData.getPropertyList(this.parent.bindingType);
    if (!dataList) {
      this._bindingSelectedEnums = [];
      CCClass.Attr.setClassAttr(this, 'bindingSelected', 'enumList', []);
      return;
    }

    const data = dataList.find((item) => { return item.name === this._bindingName; });
    if (data) {
      let count = 0;
      dataList.forEach((item) => {
        // 仅显示对象类型
        if (item.type == data.type && item.kind != DataKind.Array) {
          newEnums.push({ name: item.name, value: count++ });
        }
      });
    }
    // 设置绑定数据枚举
    this._bindingSelectedEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'bindingSelected', 'enumList', newEnums);

    // 如果绑定数据枚举为空，则警告
    if (this._bindingSelectedEnums.length === 0) {
      console.warn(`PATH ${this.getNodePath()} 组件 ItemsSource 绑定未找到合适的数据（列表数据）。`);
    }

    // 设置绑定数据枚举默认值
    if (this._bindingSelectedName !== '') {
      let findIndex = this._bindingSelectedEnums.findIndex((item) => { return item.name === this._bindingSelectedName; });
      if (findIndex != -1) {
        this.bindingSelected = findIndex;
        return;
      }
      else {
        console.warn(`PATH ${this.getNodePath()} 组件 ItemsSource 绑定 ${this._bindingSelectedName} 已经不存在。`);
        // 如果只有一个枚举，就设置为默认值
        if (this._bindingSelectedEnums.length == 1) {
          this.bindingSelected = 0;
          return;
        }
      }
    }
    this.bindingSelected = 0;
  }
  //#endregion

  protected onLoad() {
    this.bindDataKind = DataKind.Array;
    this.initTemplate();

    super.onLoad();
    if (EDITOR) {
      this.updateEditorBindingSelectedEnums();
      return;
    }
  }

  protected onDestroy() {
    super.onDestroy();

    // 清理观察函数
    this._itemsWatchHandle?.stop();
    this._itemsWatchHandle = null;
  }

  /** 观察函数 */
  private _itemsWatchHandle: WatchHandle | null = null;
  protected onUpdateDataInternal() {
    if (!Array.isArray(this._data)) {
      this.initItems([]);
      return;
    }

    // 清理旧的观察函数
    this._itemsWatchHandle?.stop();
    this._itemsWatchHandle = null;

    // 设置数组观察函数
    this._itemsWatchHandle = watch(() => this._data.length, (operation) => {
      // 更新数组
      if (!operation) {
        // 第一次初始化操作
        this.initItems(this._data);
        return;
      }

      // 判断删除
      if (operation.deletedStart >= 0) {
        for (let i = 0; i < operation.deleted.length; i++) {
          this.deleteItemByIndex(operation.deletedStart, operation.deleted[i]);
        }
      }
      // 判断添加
      if (operation.insertedStart >= 0) {
        for (let i = 0; i < operation.inserted.length; i++) {
          let item = operation.inserted[i];
          this.addItem(operation.insertedStart + i, item);
        }
      }

    }, { immediate: true });
  }

  private _content: Node = null;
  private _template: Node = null;
  private initTemplate() {
    if (EDITOR) return;

    if (!this.template) {
      console.warn(`PATH ${this.getNodePath()} 组件 ItemsSource 没有设置模板节点`);
      return;
    }
    this._template = this.template;
    this._content = this._template.parent;
    this._template.active = false;
    this._template.removeFromParent();
  }

  private _nodeList: Node[] = [];
  private initItems(dataList: any[]) {
    // 清理
    this._nodeList = [];
    if (this._content) {
      this._content.children.forEach((child) => {
        child.destroy();
      });
      this._content.removeAllChildren();
    }
    // 添加默认值
    if (dataList && dataList.length > 0) {
      dataList.forEach((item, index) => {
        this.addItem(index, item);
      });
    }
  }

  private addItem(index: number, data: any) {
    if (index < 0) return;
    if (!this._template || !this._content) return;

    let node = instantiate(this._template);
    this._content.insertChild(node, index);
    node.active = true;
    this._nodeList.splice(index, 0, node);

    if (this._isSelected) {
      node.off(Node.EventType.TOUCH_END);
      node.on(Node.EventType.TOUCH_END, () => {
        const proxy = reactive(data);
        if (!this.parent?.dataContext) return;
        this.parent.dataContext[this._bindingSelectedName] = proxy;
      }, this);
    }
  }

  private deleteItemByIndex(index: number, deletedData?: any) {
    if (index < 0) return;
    if (index >= this._nodeList.length) return;

    const node = this._nodeList[index];
    if (this._isSelected && this.clearSelectedOnDelete && this.parent?.dataContext) {
      const proxy = reactive(deletedData);
      if (this.parent.dataContext[this._bindingSelectedName] === proxy) {
        this.parent.dataContext[this._bindingSelectedName] = null;
      }
    }

    node.removeFromParent();
    node.destroy();
    this._nodeList.splice(index, 1);
  }

  private getItemIndex(node: Node) {
    if (!this._content) return -1;
    let template = node;
    while (template) {
      if (template.parent === this._content) {
        return template.getSiblingIndex();
      }
      if (template === this.node) {
        return -1;
      }
      template = template.parent;
    }
    return -1;
  }

  /**
   * 获取数据上下文
   * @param target 注册对象
   * @returns 数据上下文
   */
  getDataContextInRegister(target: any) {
    if (!this._registry.has(target)) return null;

    let index = this.getItemIndex(target.node);
    if (index < 0) return null;

    // 基础类型数据，重新设置上级数据和绑定名称
    if (target._bindingName === target._bindingType || Number.isInteger(Number(target._bindingName))) {
      target._bindingName = `${index}`;
      return this._data;
    }

    return reactive(this._data[index]);
  }

  deleteItemWithRegister(target: any) {
    if (!this._registry.has(target)) return;

    let index = this.getItemIndex(target.node);
    if (index < 0) return;

    this._data.splice(index, 1);
  }
}

/** ItemsSourceData 静态类 */
export class ItemsSourceData {
  /** 
   * 获取绑定的数据
   * @param node 有挂载 ItemsSource 的节点
   */
  static get<T = any>(node: Node): T {
    return ItemsSource.Data<T>(node);
  }
}