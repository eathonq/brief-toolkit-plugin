/**
 * Binding.ts - 数据绑定组件
 * @description 该组件用于绑定组件元素值与数据属性的关联，并可以选择绑定模式。支持双向绑定、单向绑定和一次性绑定等多种模式，适用于不同的使用场景。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/mvvm/binding}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-03-02
 * @modified 2026-03-11
 */

import { _decorator, Node, Enum, Sprite, Button, CCClass, Label, ProgressBar } from 'cc';
import { EDITOR } from 'cc/env';
import { watch, WatchHandle } from '../core/Reactive';
import { CCElement } from '../core/CCElement';
import { DataKind, decoratorData } from '../core/DecoratorData';
import { DataContext } from "./DataContext";
import { ItemsSource } from './ItemsSource';

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

const ITEMS_SOURCE_DELETE = 'ITEMS_SOURCE_DELETE';

/** 绑定模式 */
export enum BindingMode {
  /** 双向绑定(Model<=>View)，导致对绑定源或目标属性(UI)的更改自动更新另一个。 */
  TwoWay = 0,
  /** 单向绑定(Model->View)，当绑定源改变时更新绑定目标属性(UI)。 */
  OneWay = 1,
  /** 一次绑定(Model->View)，当绑定源改变时更新绑定目标属性(UI)，仅通知一次。 */
  OneTime = 2,
  /** 单向绑定(View->Model)，当绑定目标属性(UI)改变时更新绑定源。 */
  OneWayToSource = 3,
}

/** 
 * 数据绑定组件
 * 绑定上级数据中的基础类型数据（String、Number、Boolean、Function）到组件上
 */
@ccclass('mvvm.Binding')
@help('https://vangagh.gitbook.io/brief-toolkit/mvvm/binding')
@executeInEditMode
@menu('BriefToolkit/Mvvm/Binding')
export class Binding extends CCElement {
  /**
   * 获取绑定数据
   * @param node 有挂载 Binding 的节点
   * @param isParent 是否获取上级数据, 默认为 false
   */
  static Data<T = any>(node: Node, isParent = false): T {
    let binding = node.getComponent(Binding);
    if (!binding) return null;
    if (!binding._parent) return null;

    const dataContext = binding._parent.getDataContextInRegister(binding);
    if (dataContext == null) return null;

    if (isParent)
      return dataContext as T;
    else
      return dataContext[binding._bindingName] as T;
  }

  /** 数据上下文路径 */
  @property(DataContext)
  private _parent: DataContext = null;
  @property({
    type: DataContext,
    displayName: 'DataContext',
    tooltip: '数据上下文',
    displayOrder: 0,
  })
  get parent() {
    return this._parent;
  }
  private set parent(value) {
    this._parent = value;
    this.updateEditorModeEnums();
    this.updateEditorBindingEnums();
  }

  @property
  private _bindingMode = -1; // 挂载 @property 属性值保存到场景等资源文件中，用于 binding 数据恢复
  private _modeEnums: { name: string, value: number, mode: BindingMode }[] = [];
  private _mode = 0;
  /** 绑定模式 */
  @property({
    type: Enum({}),
    tooltip: '绑定模式:\n TwoWay: 双向绑定(Model<->View);\n OneWay: 单向绑定(Model->View);\n OneTime: 一次单向绑定(Model->View);\n OneWayToSource: 单向绑定(View->Model)。',
    displayOrder: 3,
  })
  get mode() {
    return this._mode;
  }
  private set mode(value) {
    const safeIndex = this._modeEnums[value] ? value : 0;
    this._mode = safeIndex;
    if (this._modeEnums[safeIndex]) {
      this._bindingMode = this._modeEnums[safeIndex].mode;
    }
  }

  @property
  private _bindingType = "";  // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  get bindingType() {
    return this._bindingType;
  }

  @property
  private _bindingName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  get bindingName() {
    return this._bindingName;
  }

  private _bindingEnums: { name: string, value: number, type: string }[] = [];
  private _binding = 0;
  /** 绑定属性 */
  @property({
    type: Enum({}),
    tooltip: '绑定属性',
    displayOrder: 4,
  })
  get binding() {
    return this._binding;
  }
  private set binding(value) {
    const safeIndex = this._bindingEnums[value] ? value : 0;
    this._binding = safeIndex;
    if (this._bindingEnums[safeIndex]) {
      this._bindingName = this._bindingEnums[safeIndex].name;
      this._bindingType = this._bindingEnums[safeIndex].type;
      this.selectedBinding();
    }
  }

  /** 上一级绑定数据 */
  private _upperData: any = null;

  /** 当前绑定数据 */
  protected _data: any = null;
  /** 当前绑定数据 */
  get dataContext() {
    return this._data;
  }

  //#region EDITOR
  onRestore() {
    this._parent = null;
    super.onRestore();
  }

  protected checkEditorComponent() {
    this.initParentDataContext();
    if (!this._parent) return; // 上下文数据异常，则不继续执行
    super.checkEditorComponent();
  }

  protected selectedProperty() {
    super.selectedProperty();

    // 这里设置会导致绑定数据丢失的问题
    // // 重置绑定模式
    // this._bindingMode = -1;
    // // 重置绑定数据
    // this._bindingName = '';

    if (!this._parent) return; // 上下文数据异常，则不继续执行
    this.updateEditorModeEnums();
    this.updateEditorBindingEnums();
  }

  /** 更新绑定模式枚举 */
  private updateEditorModeEnums() {
    const newEnums: { name: string, value: number, mode: BindingMode }[] = [];
    let count = 0;
    switch (this._elementName) {
      case Label.name:
        newEnums.push(...[
          { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
          { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
        ]);
        break;
      case Button.name:
        newEnums.push(...[
          { name: 'OneWayToSource', value: count++, mode: BindingMode.OneWayToSource },
        ]);
        break;
      case ProgressBar.name:
        newEnums.push(...[
          { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
          { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
        ]);
        break;
      case Sprite.name:
        newEnums.push(...[
          { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
          { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
        ]);
        break;
      case Node.name:
        if (this._elementKinds.indexOf(DataKind.Function) !== -1) {
          newEnums.push(...[
            { name: 'OneWayToSource', value: count++, mode: BindingMode.OneWayToSource },
          ]);
          break;
        }
      default:
        newEnums.push(...[
          { name: 'TwoWay', value: count++, mode: BindingMode.TwoWay },
          { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
          { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
          { name: 'OneWayToSource', value: count++, mode: BindingMode.OneWayToSource },
        ]);
        break;
    }

    this._modeEnums = newEnums;
    // 更新绑定模式枚举
    CCClass.Attr.setClassAttr(this, 'mode', 'enumList', newEnums);

    // 设置绑定模式枚举默认值
    if (this._bindingMode !== -1) {
      const findIndex = this._modeEnums.findIndex((item) => { return item.mode === this._bindingMode; });
      if (findIndex !== -1) {
        this.mode = findIndex;
        return;
      }
    }
    this.mode = 0;
  }

  /** 更新绑定数据枚举 */
  private updateEditorBindingEnums() {
    // 获取绑定属性
    const newEnums: { name: string, value: number, type: string }[] = [];
    const isFunc = this._elementKinds.indexOf(DataKind.Function) !== -1;
    if (isFunc) {
      const dataList = decoratorData.getFunctionList(this._parent.bindingType);
      if (dataList) {
        let count = 0;
        dataList.forEach((item) => {
          newEnums.push({ name: item.name, value: count++, type: item.type });
        });
      }

      // 判断 this._parent 是否为 ItemsSource
      if (this._parent instanceof ItemsSource) {
        newEnums.push({ name: ITEMS_SOURCE_DELETE, value: newEnums.length, type: '' });
      }
    }
    else {
      const dataList = decoratorData.getPropertyList(this._parent.bindingType);
      if (dataList) {
        let count = 0;
        dataList.forEach((item) => {
          if (this._elementKinds.indexOf(item.kind) !== -1) {
            newEnums.push({ name: item.name, value: count++, type: item.type });
          }
        });
      }
    }

    // 更新绑定数据枚举
    this._bindingEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'binding', 'enumList', newEnums);

    // 如果绑定数据枚举为空，则警告
    if (this._bindingEnums.length === 0) {
      this._binding = 0;
      this._bindingName = '';
      this._bindingType = '';
      console.warn(`PATH ${this.getNodePath()} 组件 Binding 绑定未找到合适的数据。`);
      return;
    }

    // 设置绑定数据枚举默认值
    if (this._bindingName !== '') {
      const findIndex = this._bindingEnums.findIndex((item) => { return item.name === this._bindingName; });
      if (findIndex !== -1) {
        this.binding = findIndex;
        return;
      }
      else {
        //console.warn(`PATH ${CCLocator.getNodeFullPath(this.node)} 组件Binding绑定 ${this._bindingName} 已经不存在`);
        // 如果只有一个枚举，就设置为默认值
        if (this._bindingEnums.length === 1) {
          this.binding = 0;
          return;
        }
      }
    }
    this.binding = 0;
  }

  protected selectedBinding() {
    if (this._parent) {
      // 如果是函数，不设置默认值
      const isFunc = this._elementKinds.indexOf(DataKind.Function) !== -1;
      if (isFunc) return;

      let path = this._parent.path;
      if (this._bindingName !== this._bindingType) {
        path = `${path}.${this._bindingName}`;
      }
      // 通过地址获取默认值
      const data = decoratorData.getDefaultInEditor(path);
      if (data != null) {
        this.setElementValue(data);
      }
    }
  }

  //#endregion

  protected onLoad() {
    super.onLoad();

    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    this.initParentDataContext();

    // 设置绑定模式
    switch (this._bindingMode) {
      case BindingMode.TwoWay:
        //this._parent?.bind(this._path, this.onDataChange, this);
        this._isObservable = true;
        this.onElementCallback(this.onElementValueChange.bind(this));
        break;
      case BindingMode.OneWay:
        this._isObservable = true;
        break;
      case BindingMode.OneTime:
        this._isObservable = true; // 在数据回调通知的时候判断接触绑定
        break;
      case BindingMode.OneWayToSource:
        this.onElementCallback(this.onElementValueChange.bind(this));
        break;
      default:
        console.warn(`PATH ${this.getNodePath()} 组件 Binding 绑定模式异常，已回退到 OneWay。`);
        this._isObservable = true;
        break;
    }

    // 组件数据初始化
    this.onUpdateData();
  }

  protected onDestroy() {
    super.onDestroy();

    if (EDITOR) return;

    this._parent?.unregister(this);

    // 清理观察函数
    this._watchHandle?.stop();
    this._watchHandle = null;
  }

  private initParentDataContext() {
    if (!this._parent) {
      this._parent = DataContext.lookUp(this.node);
      if (!this._parent) {
        console.warn(`PATH ${this.getNodePath()} 组件 Binding 找不到上级 DataContext`);
        return;
      }
    }

    this._parent.register(this, this.onUpdateData);
  }

  private _isObservable = false;
  private _watchHandle: WatchHandle | null = null;
  private onUpdateData() {
    // 上下文数据异常，则不继续执行
    if (!this._parent) return;

    // 清理旧的观察函数
    this._watchHandle?.stop();
    this._watchHandle = null;

    this._upperData = this._parent.getDataContextInRegister(this);
    if (this._upperData === null || this._upperData === undefined) {
      this.setElementValue(null);
      return;
    }

    // 判断 this._upperData 是否为对象
    if (typeof this._upperData !== 'object') {
      this._data = this._upperData;
      this.setDataValue(this._data);
      return;
    }

    this._data = this._upperData[this._bindingName];
    if (this._isObservable) {
      // 设置观察函数
      if (this._bindingType === 'Vec') {
        this._watchHandle = watch(() => {
          const data = this._upperData[this._bindingName];
          if (data && typeof data === 'object') {
            // 在 getter 阶段访问 xyz，确保建立 Vec 子属性依赖。
            data.x;
            data.y;
            data.z;
          }
          return data;
        }, (operation) => {
          if (!operation) return;
          // 子属性变化时 operation.value 可能是 number，这里统一回读完整 Vec。
          const data = this._upperData[this._bindingName];
          this.setDataValue(data);
        });
      }
      else {
        this._watchHandle = watch(() => this._upperData[this._bindingName], (operation) => {
          if (!operation) return;
          const data = operation.value;
          this.setDataValue(data);
        });
      }
    }

    this.setDataValue(this._data);
  }

  protected setDataValue(value: any) {
    this.setElementValue(value);

    // 如果是一次绑定，则解绑
    if (this._bindingMode === BindingMode.OneTime) {
      this._watchHandle?.stop();
      this._watchHandle = null;
    }
  }

  private onElementValueChange(value: any) {
    if (this._bindingName === ITEMS_SOURCE_DELETE) {
      const itemsSource = this._parent as ItemsSource;
      itemsSource.deleteItemWithRegister(this);
      return;
    }

    if (!this._upperData) return;

    const member = this._upperData[this._bindingName];
    if (typeof member === 'function') {
      member.call(this._upperData, value);
      // 如果是数组参数，展开传参
      // if (Array.isArray(value)) {
      //   member.call(this._upperData, ...value);
      // }
      // else {
      //   member.call(this._upperData, value);
      // }
      return;
    }

    if (Object.prototype.hasOwnProperty.call(this._upperData, this._bindingName)) {
      if (this._bindingType === 'Vec' && value && typeof value === 'object') {
        const current = this._upperData[this._bindingName];
        if (current && typeof current === 'object') {
          // Vec 优先字段级更新，避免整对象替换和额外分配。
          current.x = value.x;
          current.y = value.y;
          current.z = value.z;
          return;
        }
      }
      Reflect.set(this._upperData, this._bindingName, value);
    }
  }
}

/** BindingData 静态类 */
export class BindingData {
  /**
   * 获取绑定数据
   * @param node 有挂载 Binding 的节点
   * @param isParent 是否获取上级数据, 默认为 false
   * @returns 
   */
  static get<T = unknown>(node: Node, isParent = false): T {
    return Binding.Data<T>(node, isParent);
  }
}
