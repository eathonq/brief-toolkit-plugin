/**
 * DataContext.ts - 数据上下文绑定组件
 * @description 该组件用于绑定上级数据中的对象数据到组件上，提供数据上下文管理功能。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/mvvm/datacontext}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-03-02
 * @modified 2026-03-11
 */

import { _decorator, Component, Node, Enum, CCClass } from 'cc';
import { EDITOR } from 'cc/env';
import { reactive, watch, WatchHandle } from '../core/Reactive';
import { DataKind, decoratorData } from '../core/DecoratorData';

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/**
 * 数据上下文绑定组件基类
 * 绑定上级数据中的对象数据到组件上
 */
@ccclass('mvvm.DataContext')
@help('https://vangagh.gitbook.io/brief-toolkit/mvvm/datacontext')
@executeInEditMode
@menu('BriefToolkit/Mvvm/DataContext')
export class DataContext extends Component {
  /**
   * 获取绑定数据
   * @param node 有挂载 ViewModel 的节点
   */
  static Data<T = unknown>(node: Node): T | null {
    let context = node.getComponent(DataContext);
    if (!context) return null;
    return context._data as T;
  }

  private _isRoot = false;
  /** 是否数据上下文根数据  */
  get isRoot() {
    return this._isRoot;
  }
  protected set isRoot(value) {
    this._isRoot = value;
  }

  private _bindDataKind = DataKind.Object;
  /** 绑定数据种类 */
  get bindDataKind() {
    return this._bindDataKind;
  }
  protected set bindDataKind(value) {
    this._bindDataKind = value;
  }

  @property
  private _parent: DataContext = null!;
  /** 数据上下文路径 */
  @property({
    tooltip: '数据上下文',
    displayName: 'DataContext',
    readonly: true,
    visible() {
      return !this._isRoot;
    },
    displayOrder: 0,
  })
  get parent() {
    return this._parent;
  }
  protected set parent(value) {
    this._parent = value;
  }

  @property
  private _bindingType = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  /** 绑定的数据类型（类名） */
  get bindingType() {
    return this._bindingType;
  }
  protected set bindingType(value) {
    this._bindingType = value;
  }

  @property
  protected _bindingName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  get bindingName() {
    return this._bindingName;
  }

  protected _bindingEnums: { name: string, value: number, type: string }[] = [];
  private _binding = 0;
  /** 绑定对象或集合 */
  @property({
    type: Enum({}),
    tooltip: '绑定属性',
    visible() {
      return !this._isRoot;
    },
  })
  get binding() {
    return this._binding;
  }
  protected set binding(value) {
    this._binding = value;
    // 相关本地数据保存
    if (this._bindingEnums[value]) {
      this._bindingName = this._bindingEnums[value].name;
      this._bindingType = this._bindingEnums[value].type;
      const parentPath = this._parent?.path ?? '';
      this.path = parentPath ? `${parentPath}.${this._bindingName}` : this._bindingName;
    }
  }

  private _path = ''; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
  /** 数据路径（EDITOR编辑过程默认数据使用） */
  get path(): string {
    return this._path;
  }
  protected set path(val: string) {
    this._path = val;
  }

  /** 上一级绑定数据 */
  protected _upperData: unknown = null!;

  /** 当前绑定数据 */
  protected _data: unknown = null!;
  /** 当前绑定数据 */
  get dataContext() {
    return this._data;
  }

  //#region EDITOR
  onRestore() {
    if (this._isRoot) return;
    this.checkEditorComponent();
  }

  protected checkEditorComponent() {
    this._initParentDataContext();

    // 上下文数据异常，则不继续执行
    if (!this._parent) return;

    this._updateEditorBindingEnums();
  }

  /** 组件绑定数据类型更新 */
  private _updateEditorBindingEnums() {
    // 设置绑定属性
    const newEnums = [];
    let dataList = decoratorData.getPropertyList(this._parent.bindingType);
    if (dataList) {
      let count = 0;
      if (this._bindDataKind === DataKind.Object) {
        dataList.forEach((item) => {
          // 仅显示对象类型
          if (item.kind === DataKind.Object) {
            newEnums.push({ name: `${item.name}`, value: count++, type: item.type });
          }
        });
      }
      else if (this._bindDataKind === DataKind.Array) {
        dataList.forEach((item) => {
          // 仅显示数组
          if (item.kind === DataKind.Array) {
            newEnums.push({ name: `${item.name}`, value: count++, type: item.type });
          }
        });
      }
    }
    // 更新绑定数据枚举
    this._bindingEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'binding', 'enumList', newEnums);

    // 如果绑定数据枚举为空，则警告
    if (this._bindingEnums.length === 0) {
      console.warn(`PATH ${this.getNodePath()} 组件 DataContext 绑定未找到合适的数据（对象数据）。`);
    }

    // 设置绑定数据枚举默认值
    if (this._bindingName !== '') {
      let findIndex = this._bindingEnums.findIndex((item) => { return item.name === this._bindingName; });
      if (findIndex != -1) {
        this.binding = findIndex;
        return
      }
      else {
        console.warn(`PATH ${this.getNodePath()} 组件 DataContext 绑定 ${this._bindingName} 已经不存在。`);
        // 如果只有一个枚举，就设置为默认值
        if (this._bindingEnums.length == 1) {
          this.binding = 0;
          return;
        }
      }
    }
    this.binding = 0;
  }

  //#endregion

  /**
   * 子类重写此方法需要调用 super.onLoad()
   * @example
   * protected onLoad() {
   *    // 默认数据初始化
   *    // TODO
   * 
   *    super.onLoad();
   *    if (EDITOR) return;
   * 
   *    // 组件数据初始化
   *    // TODO
   * }
   */
  protected onLoad() {
    if (this._isRoot) return;

    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    this.resume();
  }

  protected onDestroy() {
    if (EDITOR) return;

    // 开发模式下检测未清理的子级注册
    if (this._registry.size > 0) {
      console.warn(
        `[DataContext] 节点 "${this.getNodePath()}" 销毁时仍有 ${this._registry.size} 个未解绑的子级注册。`,
        '注册列表:', [...this._registry.keys()],
      );
      this._registry.clear();
    }

    this.suspend();
  }

  protected getNodePath(): string {
    const names: string[] = [];
    let current: Node | null = this.node;
    while (current) {
      names.push(current.name);
      current = current.parent;
    }
    return names.reverse().join('/');
  }

  private _initParentDataContext() {
    if (!this._parent) {
      this._parent = DataContext.lookUp(this.node, this);
      if (!this._parent) {
        console.warn(`PATH ${this.getNodePath()} 组件 DataContext 找不到上级 DataContext`);
        return;
      }
    }

    this._parent.register(this, this.onUpdateData);
  }

  /** 观察函数 */
  private _watchHandle: WatchHandle = null!;
  /** 绑定数据更新，子类重写 */
  protected onUpdateData() {
    // 上下文数据异常，则不继续执行
    if (!this._parent) return;
    if (!this._bindingName) return;

    this._upperData = this._parent.getDataContextInRegister(this);
    if (this._upperData === null) return;

    const upper = this._upperData as Record<string, unknown>;

    // 清理旧的观察函数
    this._watchHandle?.stop();
    this._watchHandle = null;

    this._data = reactive(upper[this._bindingName] as object);
    this.onUpdateDataInternal();
    // 设置观察函数
    this._watchHandle = watch(() => upper[this._bindingName], (op: unknown) => {
      if (!op) return;
      this._data = reactive((op as Record<string, unknown>).value as object);
      this.onUpdateDataInternal();
      this._registry.forEach((callback, target) => {
        callback.call(target);
      });
    });
  }

  /** 绑定数据内部更新，子类重写 */
  protected onUpdateDataInternal() { }

  protected _registry: Map<object, Function> = new Map();
  /**
   * 注册
   * @param target 注册对象
   * @param onUpdateData 数据更新回调
   */
  register(target: object, onUpdateData: Function) {
    this._registry.set(target, onUpdateData);
  }

  /**
   * 取消注册
   * @param target 注册对象
   */
  unregister(target: object) {
    this._registry.delete(target);
  }

  /**
   * 获取数据上下文（需要先注册）
   * @param target 注册对象
   * @returns 数据上下文
   */
  getDataContextInRegister(target: object) {
    if (this._registry.has(target)) {
      return this._data;
    }
    return null;
  }

  // ──────────── 对象池支持 ────────────

  /** 暂停：节点入池前清理响应式依赖和事件 */
  suspend(): void {
    this._watchHandle?.stop();
    this._watchHandle = null;
    this._parent?.unregister(this);
    this._parent = null as unknown as DataContext;
  }

  /** 恢复：节点出池后重新建立上下文和数据监听 */
  resume(): void {
    this._initParentDataContext();
    this.onUpdateData();
  }

  /**
   * 向上（父节点）查找数据上下文节点
   * @param current 当前节点
   * @param self 自己的数据上下文（排除自己）
   * @returns 数据上下文节点
   */
  static lookUp(current: Node, self?: DataContext): DataContext {
    let node = current;
    while (node) {
      let dataContexts = node.getComponents(DataContext);
      if (dataContexts.length > 0) {
        if (self) {
          // 排除自己
          dataContexts = dataContexts.filter((item) => { return item !== self; });
        }
        if (dataContexts.length > 0) {
          // 返回最后一个数据上下文
          return dataContexts[dataContexts.length - 1];
        }
      }

      node = node.parent;
    }
    return null;
  }

  /**
   * 向下（子节点）查找数据上下文节点
   * @param current 当前节点
   * @returns 数据上下文节点
   */
  static lookDown(current: Node): DataContext {
    let dataContext = current.getComponentInChildren(DataContext);
    if (dataContext) {
      return dataContext;
    }
    return null;
  }
}

/** DataContextData 静态类 */
export class DataContextData {
  /**
   * 获取绑定数据
   * @param node 有挂载 ViewModel 的节点
   */
  static get<T = unknown>(node: Node): T | null {
    return DataContext.Data<T>(node);
  }
}