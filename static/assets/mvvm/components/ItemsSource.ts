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
import { MvvmNodePool } from '../core/NodePool';

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
  static Data<T = unknown>(node: Node): T | null {
    let context = node.getComponent(ItemsSource);
    if (!context) return null;
    return context._data as T;
  }

  @property({ type: [Node], tooltip: '模板节点（多个支持按数据类型选择）' })
  private templates: Node[] = [];

  @property({
    tooltip: '模板选择字段（数据中决定使用哪个模板的属性名，值为模板索引 0/1/2...）',
    displayName: 'TemplateField',
    visible() { return true; },
  })
  private _templateField = '';

  /** 对象池 */
  private _pool: MvvmNodePool = new MvvmNodePool();

  @property
  private _isSelected: boolean = false;
  @property({ tooltip: '是否绑定选中项' })
  get isSelected() {
    return this._isSelected;
  }
  private set isSelected(value) {
    this._isSelected = value;
    this._updateEditorBindingSelectedEnums();
  }

  @property({
    tooltip: '删除列表项时是否清空选中绑定',
    visible() {
      return (this as any)._isSelected;
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
      return (this as any)._isSelected;
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

  private _updateEditorBindingSelectedEnums() {
    if (!this._isSelected) return;
    if (!this.parent) return;

    // 获取绑定属性
    const newEnums: { name: string; value: number; }[] = [];
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
    this._initTemplate();

    super.onLoad();
    if (EDITOR) {
      this._updateEditorBindingSelectedEnums();
      return;
    }
  }

  protected onDestroy() {
    super.onDestroy();

    // 清理观察函数
    this._itemsWatchHandle?.stop();
    this._itemsWatchHandle = null;

    // 清空对象池
    this._pool.clear();
  }

  /** 观察函数 */
  private _itemsWatchHandle: WatchHandle | null = null;
  protected onUpdateDataInternal() {
    if (!Array.isArray(this._data)) {
      this._initItems([]);
      return;
    }

    const dataList = this._data as unknown[];

    // 清理旧的观察函数
    this._itemsWatchHandle?.stop();
    this._itemsWatchHandle = null;

    // 设置数组观察函数
    // eslint-disable-next-line prefer-const
    let arrayCb: (operation?: unknown) => void;
    // 使用 callback.length === 1 让运行时走 WatchCallback 路径
    arrayCb = (operation: any) => {
      if (!operation) {
        this._initItems(dataList);
        return;
      }
      if (operation.deletedStart != null && operation.deletedStart >= 0 && operation.deleted) {
        for (let i = 0; i < operation.deleted.length; i++) {
          this._deleteItemByIndex(operation.deletedStart, operation.deleted[i]);
        }
      }
      if (operation.insertedStart != null && operation.insertedStart >= 0 && operation.inserted) {
        for (let i = 0; i < operation.inserted.length; i++) {
          let item = operation.inserted[i];
          this._addItem(operation.insertedStart + i, item);
        }
      }
    };
    this._itemsWatchHandle = watch(() => dataList.length, arrayCb as any, { immediate: true });
  }

  private _content: Node | null = null;
  private _initTemplate() {
    if (EDITOR) return;

    if (this.templates.length === 0) {
      console.warn(`PATH ${this.getNodePath()} 组件 ItemsSource 没有设置模板节点`);
      return;
    }
    // 所有模板移出场景树并隐藏
    this._content = this.templates[0].parent;
    for (const tpl of this.templates) {
      tpl.active = false;
      tpl.removeFromParent();
    }
  }

  /** 根据 item[templateField] 选择模板；无 templateField 或只有 1 个模板时直接返回 templates[0] */
  private _getTemplateForItem(item: unknown): Node {
    if (this.templates.length <= 1 || !this._templateField) return this.templates[0];
    const idx = Number((item as Record<string, unknown>)?.[this._templateField]);
    if (Number.isInteger(idx) && idx >= 0 && idx < this.templates.length) {
      return this.templates[idx];
    }
    return this.templates[0];
  }

  private _nodeList: Node[] = [];
  private _initItems(dataList: unknown[]) {
    // 清理 — 回池而非销毁
    this._nodeList = [];
    if (this._content) {
      for (const child of [...this._content.children]) {
        this._pool.put(child, this.templates[0]);
      }
      this._content.removeAllChildren();
    }
    if (dataList && dataList.length > 0) {
      dataList.forEach((item, index) => {
        this._addItem(index, item);
      });
    }
  }

  private _addItem(index: number, data: unknown) {
    if (index < 0) return;
    if (this.templates.length === 0 || !this._content) return;

    const tpl = this._getTemplateForItem(data);
    // 池取优先；fromPool 在 instantiate 之前记录
    const pooled = this._pool.get(tpl);
    const fromPool = pooled !== null;
    const node = pooled ?? instantiate(tpl);

    this._content.insertChild(node, index);
    node.active = true;

    // 池节点必须在 insertChild 后恢复（此时 getItemIndex 才能找到节点在 content 中的位置）
    if (fromPool) {
      this._pool.resumeNode(node);
    }

    this._nodeList.splice(index, 0, node);

    if (this._isSelected) {
      node.off(Node.EventType.TOUCH_END);
      node.on(Node.EventType.TOUCH_END, () => {
        const proxy = reactive(data as object);
        if (!this.parent?.dataContext) return;
        (this.parent.dataContext as Record<string, unknown>)[this._bindingSelectedName] = proxy;
      }, this);
    }
  }

  private _deleteItemByIndex(index: number, deletedData?: unknown) {
    if (index < 0) return;
    if (index >= this._nodeList.length) return;

    const node = this._nodeList[index];
    if (this._isSelected && this.clearSelectedOnDelete && this.parent?.dataContext) {
      const proxy = reactive(deletedData as object);
      if ((this.parent.dataContext as Record<string, unknown>)[this._bindingSelectedName] === proxy) {
        (this.parent.dataContext as Record<string, unknown>)[this._bindingSelectedName] = null;
      }
    }

    node.removeFromParent();
    const tpl = this._getTemplateForItem(deletedData);
    this._pool.put(node, tpl);
    this._nodeList.splice(index, 1);
  }

  private _getItemIndex(node: Node) {
    if (!this._content) return -1;
    let template: Node | null = node;
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
  getDataContextInRegister(target: object) {
    if (!this._registry.has(target)) return null;

    // 内部访问 Binding 的私有属性（运行时多态）
    const b = target as unknown as { node: Node; _bindingName: string; _bindingType: string };
    let index = this._getItemIndex(b.node);
    if (index < 0) return null;

    // 基础类型数据，重新设置上级数据和绑定名称
    if (b._bindingName === b._bindingType || Number.isInteger(Number(b._bindingName))) {
      b._bindingName = `${index}`;
      return this._data;
    }

    return reactive((this._data as unknown[])[index] as object);
  }

  deleteItemWithRegister(target: object) {
    if (!this._registry.has(target)) return;

    const bindingTarget = target as unknown as { node: Node };
    let index = this._getItemIndex(bindingTarget.node);
    if (index < 0) return;

    (this._data as unknown[]).splice(index, 1);
  }
}

/** ItemsSourceData 静态类 */
export class ItemsSourceData {
  /**
   * 获取绑定的数据
   * @param node 有挂载 ItemsSource 的节点
   */
  static get<T = unknown>(node: Node): T | null {
    return ItemsSource.Data<T>(node);
  }
}