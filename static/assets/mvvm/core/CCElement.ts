/**
 * CCElement.ts - Cocos Creator 元素组件
 * @description 该组件用于识别 Cocos Creator 中常用组件（如 Label、Button 等）或节点，
 * 并提供统一的接口设置值和监听事件变化，方便与 MVVM 框架的数据绑定。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/mvvm/ccelement}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 * 
 * @created 2023-03-02
 * @modified 2026-06-25
 */

import { _decorator, Component, Node, Label, RichText, EditBox, Toggle, Button, Slider, ProgressBar, PageView, Sprite, ToggleContainer, UITransform, Enum, CCClass, EventHandler } from 'cc';
import { EDITOR } from 'cc/env';
import { DataKind } from './DecoratorData';
import { AssetScopeManager } from '../../common/core/AssetScopeManager';
import { ComponentProxy } from './ComponentProxy';
import { batch } from './Reactive';

const { ccclass, property, help, executeInEditMode } = _decorator;

type ElementBinding = {
  name: string;
  kind: DataKind[];
  setValue?: (value: any) => void;
  bindCallback?: () => void;
  createData?: () => any;
};

type Element = {
  name: string;
  component: any;
  binding: ElementBinding[];
}

const CC_ELEMENT_CLASS_NAME = 'private.CCElement';

export const MVVM_NODE_TAG_KEY = '__mvvm_node_tag_key__';

/**
 * Cocos Creator 元素
 * 用于识别元素的数据类型
 * 不直接使用，请使用 Binding 组件
 */
@ccclass(CC_ELEMENT_CLASS_NAME)
@help('https://vangagh.gitbook.io/brief-toolkit/mvvm/ccelement')
@executeInEditMode
export class CCElement extends Component {
  private _disposers: Array<() => void> = [];
  private readonly _elementRegistry: Element[] = this._createElementRegistry();
  private _runtimeSetHandler: ((value: any) => void) = null!;
  private _runtimeBindHandler: (() => void) = null!;
  private _runtimeDataCreator: (() => any) = null!;

  private _createElementRegistry(): Element[] {
    return [
      {
        name: Label.name,
        component: Label,
        binding: [
          {
            name: 'string',
            kind: [DataKind.String, DataKind.Number, DataKind.Boolean],
            setValue: (value) => this._setLabelValue(value)
          }
        ]
      },
      {
        name: RichText.name,
        component: RichText,
        binding: [
          {
            name: 'string',
            kind: [DataKind.String, DataKind.Number, DataKind.Boolean],
            setValue: (value) => this._setRichTextValue(value)
          }
        ]
      },
      {
        name: EditBox.name,
        component: EditBox,
        binding: [
          {
            name: 'string',
            kind: [DataKind.String, DataKind.Number, DataKind.Boolean],
            setValue: (value) => this._setEditBoxValue(value),
            bindCallback: () => this._bindEditBoxCallback()
          }
        ]
      },
      {
        name: Toggle.name,
        component: Toggle,
        binding: [
          {
            name: 'isChecked',
            kind: [DataKind.Boolean],
            setValue: (value) => this._setToggleValue(value),
            bindCallback: () => this._bindToggleCallback()
          }
        ]
      },
      {
        name: Button.name,
        component: Button,
        binding: [
          {
            name: 'click',
            kind: [DataKind.Function],
            bindCallback: () => this._bindButtonCallback()
          }
        ]
      },
      {
        name: Slider.name,
        component: Slider,
        binding: [
          {
            name: 'progress',
            kind: [DataKind.Number],
            setValue: (value) => this._setSliderValue(value),
            bindCallback: () => this._bindSliderCallback()
          }
        ]
      },
      {
        name: ProgressBar.name,
        component: ProgressBar,
        binding: [
          {
            name: 'progress',
            kind: [DataKind.Number],
            setValue: (value) => this._setProgressBarValue(value)
          }
        ]
      },
      {
        name: PageView.name,
        component: PageView,
        binding: [
          {
            name: 'currentPageIndex',
            kind: [DataKind.Number],
            setValue: (value) => this._setPageViewValue(value),
            bindCallback: () => this._bindPageViewCallback()
          }
        ]
      },
      {
        name: Sprite.name,
        component: Sprite,
        binding: [
          {
            name: 'spriteFrame',
            kind: [DataKind.String],
            setValue: (value) => this._setSpriteValue(value)
          }
        ]
      },
      {
        name: ToggleContainer.name,
        component: ToggleContainer,
        binding: [
          {
            name: 'checkedIndex',
            kind: [DataKind.Number],
            setValue: (value) => this._setToggleContainerValue(value),
            bindCallback: () => this._bindToggleContainerCallback()
          }
        ]
      },
      {
        name: Node.name,
        component: Node,
        binding: [
          {
            name: 'active',
            kind: [DataKind.Boolean, DataKind.Number, DataKind.String, DataKind.Object],
            setValue: (value) => this._setNodeActiveValue(value),
            bindCallback: () => this._bindNodeActiveCallback()
          },
          {
            name: 'position',
            kind: [DataKind.Vec],
            setValue: (value) => this._setNodePositionValue(value),
            bindCallback: () => this._bindNodePositionCallback()
          },
          {
            name: 'touch-start',
            kind: [DataKind.Function],
            bindCallback: () => this._bindNodeTouchCallback(Node.EventType.TOUCH_START)
          },
          {
            name: 'touch-move',
            kind: [DataKind.Function],
            bindCallback: () => this._bindNodeTouchCallback(Node.EventType.TOUCH_MOVE)
          },
          {
            name: 'touch-end',
            kind: [DataKind.Function],
            bindCallback: () => this._bindNodeTouchCallback(Node.EventType.TOUCH_END)
          },
          {
            name: 'tag',
            kind: [DataKind.String],
            setValue: (value) => this._setNodeCustomValue(value)
          }
        ]
      },
      {
        name: Component.name,
        component: Component,
        binding: [
          {
            name: 'property',
            kind: [DataKind.Boolean, DataKind.Number, DataKind.String, DataKind.Object],
            setValue: (value) => this._setComponentPropertyValue(value)
          },
          {
            name: 'proxy',
            kind: [DataKind.Proxy],
            createData: () => new ComponentProxy(this._getUserComponent()!)
          }
        ]
      }
    ];
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

  private _getSafeComponent<T>(component: new (...args: any[]) => T): T | null {
    const target = this.node.getComponent(component as any) as T | null;
    if (!target) {
      console.warn(`PATH ${this.getNodePath()} 缺少组件 ${component.name}，绑定操作已忽略`);
      return null;
    }
    return target;
  }

  private _clearRuntimeListeners() {
    if (this._disposers.length > 0) {
      for (let i = this._disposers.length - 1; i >= 0; i--) {
        try {
          this._disposers[i]();
        }
        catch (error) {
          console.warn('CCElement listener dispose failed', error);
        }
      }
      this._disposers.length = 0;
    }
  }

  private _addDisposer(disposer: () => void) {
    this._disposers.push(disposer);
  }

  @property
  protected _elementName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于 binding 数据恢复
  private _elementEnums: { name: string, value: number }[] = [];
  private _bindingElement = 0;
  /** 绑定元素的名字 */
  @property({
    type: Enum({}),
    displayName: 'Element',
    tooltip: '绑定元素（组件或节点）',
    displayOrder: 1,
  })
  get bindingElement() {
    return this._bindingElement;
  }
  protected set bindingElement(value) {
    this._bindingElement = value;
    if (this._elementEnums[value]) {
      this._elementName = this._elementEnums[value].name;
      this._selectedComponent();
      this._refreshRuntimeHandlers();
    }
  }

  @property
  protected _propertyName = "";
  private _propertyEnums: { name: string, value: number }[] = [];
  private _bindingProperty = 0;
  /** 组件上需要监听的属性 */
  @property({
    type: Enum({}),
    displayName: 'Property',
    tooltip: '绑定元素属性（属性或方法）',
    visible() {
      if (this._elementName !== 'Component') return true;
      return this._propertyEnums.length > 1;
    },
    displayOrder: 2,
  })
  get bindingProperty() {
    return this._bindingProperty;
  }
  protected set bindingProperty(value) {
    this._bindingProperty = value;
    if (this._propertyEnums[value]) {
      this._propertyName = this._propertyEnums[value].name;
      this.selectedProperty();
      this._refreshRuntimeHandlers();
    }
  }

  /** 组件上需要监听的属性的数据类型 */
  protected _elementKinds: DataKind[] = [];

  /** 绑定方法自定义参数 */
  @property({
    tooltip: '绑定方法自定义参数',
    displayName: 'CustomEventData',
    visible() {
      return this._elementKinds.indexOf(DataKind.Function) != -1;
    },
    displayOrder: 10,
  })
  private customEventData: string = "";

  @property
  protected _componentTargetName = "";
  private _componentTargetEnums: { name: string, value: number }[] = [];
  private _componentTarget = 0;
  /** 用户组件选择 */
  @property({
    type: Enum({}),
    displayName: 'ComponentTarget',
    tooltip: '目标用户组件',
    visible() {
      return this._elementName === 'Component';
    },
    displayOrder: 1.1,
  })
  get componentTarget() {
    return this._componentTarget;
  }
  protected set componentTarget(value) {
    this._componentTarget = value;
    if (this._componentTargetEnums[value]) {
      this._componentTargetName = this._componentTargetEnums[value].name;
      this._updateEditorComponentPropertyEnums();
    }
  }

  @property
  protected _componentPropertyName = "";
  private _componentPropertyEnums: { name: string, value: number }[] = [];
  private _componentPropertyIndex = 0;
  /** 用户组件目标属性 */
  @property({
    type: Enum({}),
    displayName: 'ComponentProperty',
    tooltip: '目标用户组件的属性',
    visible() {
      return this._elementName === 'Component' && this._propertyName === 'property';
    },
    displayOrder: 2.1,
  })
  get componentProperty() {
    return this._componentPropertyIndex;
  }
  protected set componentProperty(value) {
    this._componentPropertyIndex = value;
    if (this._componentPropertyEnums[value]) {
      this._componentPropertyName = this._componentPropertyEnums[value].name;
    }
  }

  // @property({
  //   type: [CCString],
  //   tooltip: '绑定方法自定义参数数组',
  //   displayName: 'Params',
  //   visible() {
  //     return this._elementKinds.indexOf(DataKind.Function) != -1;
  //   },
  //   displayOrder: 10,
  // })
  // private customEventDataArray: string[] = [];

  //#region EDITOR
  onRestore() {
    this._elementName = '';
    this._propertyName = '';
    this._componentTargetName = '';
    this._componentPropertyName = '';
    this.checkEditorComponent();
  }

  protected checkEditorComponent() {
    this._identifyComponent();
    this._updateEditorElementEnums();
  }

  /** 识别到的组件列表 */
  private _identifyList: Element[] = [];
  private _identifyComponent() {
    this._identifyList = [];
    for (let i = 0; i < this._elementRegistry.length; i++) {
      const element = this._elementRegistry[i];
      if (element.component === Node) {
        this._identifyList.push(element);
      }
      else if (element.component === Component) {
        if (this._hasUserComponent()) {
          this._identifyList.push(element);
        }
      }
      else if (this.node.getComponent(element.component)) {
        this._identifyList.push(element);
      }
    }
  }

  private _updateEditorElementEnums() {
    const newEnums = [];
    if (this._identifyList.length > 0) {
      for (let i = 0; i < this._identifyList.length; i++) {
        const element = this._identifyList[i];
        newEnums.push({ name: element.name, value: i });
      }
    }

    this._elementEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'bindingElement', 'enumList', newEnums);

    // 设置绑定数据枚举默认值
    if (this._elementName !== '') {
      const findIndex = this._elementEnums.findIndex((item) => { return item.name === this._elementName; });
      if (findIndex != -1) {
        this.bindingElement = findIndex;
        return;
      }
    }
    this.bindingElement = 0;
  }

  private _updateEditorPropertyEnums() {
    const newEnums = [];
    if (this._identifyList.length > 0) {
      const element = this._identifyList[this._bindingElement];
      if (element) {
        for (let i = 0; i < element.binding.length; i++) {
          newEnums.push({ name: element.binding[i].name, value: i });
        }
      }
    }

    this._propertyEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'bindingProperty', 'enumList', newEnums);

    // 设置绑定数据枚举默认值
    if (this._propertyName !== '') {
      let findIndex = this._propertyEnums.findIndex((item) => { return item.name === this._propertyName; });
      if (findIndex != -1) {
        this.bindingProperty = findIndex;
        return;
      }
    }
    this.bindingProperty = 0;
  }

  private _updateEditorComponentTargetEnums() {
    if (this._elementName !== Component.name) {
      this._componentTarget = 0;
      this._componentTargetEnums = [];
      return;
    }

    const userComps = this._getUserComponents();
    const newEnums: { name: string, value: number }[] = [];
    for (let i = 0; i < userComps.length; i++) {
      newEnums.push({ name: userComps[i].constructor.name, value: i });
    }

    this._componentTargetEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'componentTarget', 'enumList', newEnums);

    if (this._componentTargetName !== '' && newEnums.length > 0) {
      const findIndex = newEnums.findIndex((item) => item.name === this._componentTargetName);
      if (findIndex !== -1) {
        this.componentTarget = findIndex;
        return;
      }
    }
    this.componentTarget = 0;
  }

  private _updateEditorComponentPropertyEnums() {
    if (this._elementName !== Component.name) {
      this._componentPropertyIndex = 0;
      this._componentPropertyEnums = [];
      return;
    }

    const comp = this._getUserComponent();
    if (!comp) {
      this._componentPropertyIndex = 0;
      this._componentPropertyEnums = [];
      return;
    }

    const baseKeys = new Set([
      '_name', '_objFlags', '_enabled',
      'node', 'uuid', '_id', '__scriptAsset', '_prefab',
      '_sceneGetter', 'gizmo', 'iconGizmo', 'persistentGizmo',  // 编辑器注入
    ]);

    const seen = new Set<string>();
    const newEnums: { name: string, value: number }[] = [];
    let count = 0;

    // 扫描实例自有属性
    for (const key of Object.keys(comp)) {
      if (baseKeys.has(key)) continue;
      if (key.startsWith('__') || key.startsWith('_')) continue;
      seen.add(key);
      newEnums.push({ name: key, value: count++ });
    }

    // 扫描原型链上的 getter/setter（如 get data() / set data()）
    let proto = Object.getPrototypeOf(comp);
    while (proto && proto !== Component.prototype) {
      const protoKeys = Object.getOwnPropertyNames(proto);
      for (let i = 0; i < protoKeys.length; i++) {
        const key = protoKeys[i];
        if (seen.has(key)) continue;
        if (baseKeys.has(key)) continue;
        if (key.startsWith('__') || key.startsWith('_')) continue;
        if (key === 'constructor') continue;
        const desc = Object.getOwnPropertyDescriptor(proto, key);
        if (!desc || (!desc.get && !desc.set)) continue;
        seen.add(key);
        newEnums.push({ name: key, value: count++ });
      }
      proto = Object.getPrototypeOf(proto);
    }

    this._componentPropertyEnums = newEnums;
    CCClass.Attr.setClassAttr(this, 'componentProperty', 'enumList', newEnums);

    if (this._componentPropertyName !== '' && newEnums.length > 0) {
      const findIndex = newEnums.findIndex((item) => item.name === this._componentPropertyName);
      if (findIndex !== -1) {
        this.componentProperty = findIndex;
        return;
      }
    }
    this.componentProperty = 0;
  }

  private _selectedComponent() {
    this._updateEditorPropertyEnums();
    this._updateEditorComponentTargetEnums();
    this._updateEditorComponentPropertyEnums();
  }

  protected selectedProperty() {
    const element = this._identifyList[this._bindingElement];
    if (element) {
      this._elementKinds = element.binding[this._bindingProperty].kind;
    }
    else {
      this._elementKinds = [];
    }
    this._refreshRuntimeHandlers();
  }
  //#endregion

  protected onLoad() {
    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    this._refreshRuntimeHandlers();
  }

  protected onDestroy() {
    this._clearRuntimeListeners();
    this._runtimeSetHandler = null;
    this._runtimeBindHandler = null;
    this._runtimeDataCreator = null;
  }

  /** 暂停：清理 UI 事件监听（对象池回收用） */
  suspend(): void {
    this._clearRuntimeListeners();
  }

  /** 恢复：重建运行时处理器（对象池复用用） */
  resume(): void {
    this._refreshRuntimeHandlers();
  }

  private _getRuntimeBindingConfig(): ElementBinding | null {
    const element = this._elementRegistry.find((item) => item.name === this._elementName);
    if (!element) {
      return null;
    }

    if (this._propertyName !== '') {
      const propertyBinding = element.binding.find((item) => item.name === this._propertyName);
      if (propertyBinding) {
        return propertyBinding;
      }
    }

    return element.binding[0] ?? null;
  }

  private _refreshRuntimeHandlers() {
    const bindingConfig = this._getRuntimeBindingConfig();
    this._runtimeSetHandler = bindingConfig?.setValue ?? null;
    this._runtimeBindHandler = bindingConfig?.bindCallback ?? null;
    this._runtimeDataCreator = bindingConfig?.createData ?? null;
  }

  createRuntimeData(): any {
    return this._runtimeDataCreator?.() ?? null;
  }

  protected setElementValue(value: any) {
    if (!this._runtimeSetHandler) {
      return;
    }
    this._runtimeSetHandler(value);
  }

  private _elementValueChange: (value: any) => void = null!;
  protected onElementCallback(elementValueChange: (value: any) => void) {
    this._clearRuntimeListeners();
    this._elementValueChange = elementValueChange;
    if (!this._runtimeBindHandler) {
      return;
    }
    this._runtimeBindHandler();
  }

  private _toStringValue(value: any): string {
    if (value === undefined || value === null) {
      return "";
    }
    return `${value}`;
  }

  private _toNumberValue(value: any, fallback = 0): number {
    if (value === undefined || value === null) {
      return fallback;
    }
    return Number(value);
  }

  private _setLabelValue(value: any) {
    const label = this._getSafeComponent(Label);
    if (!label) return;
    label.string = this._toStringValue(value);
  }

  private _setRichTextValue(value: any) {
    const richText = this._getSafeComponent(RichText);
    if (!richText) return;
    richText.string = this._toStringValue(value);
  }

  private _setEditBoxValue(value: any) {
    const editBox = this._getSafeComponent(EditBox);
    if (!editBox) return;
    editBox.string = this._toStringValue(value);
  }

  private _setToggleValue(value: any) {
    const toggle = this._getSafeComponent(Toggle);
    if (!toggle) return;
    toggle.isChecked = Boolean(value);
  }

  private _setSliderValue(value: any) {
    const slider = this._getSafeComponent(Slider);
    if (!slider) return;
    slider.progress = this._toNumberValue(value);
  }

  private _setProgressBarValue(value: any) {
    const progressBar = this._getSafeComponent(ProgressBar);
    if (!progressBar) return;
    progressBar.progress = this._toNumberValue(value);
  }

  private _setPageViewValue(value: any) {
    const pageView = this._getSafeComponent(PageView);
    if (!pageView) return;

    const index = this._toNumberValue(value);

    // 使用 Promise 或 nextTick 延迟到下一帧执行
    Promise.resolve().then(() => {
      if (this.node && pageView.isValid) {
        pageView.setCurrentPageIndex(index);
      }
    });
  }

  private _setSpriteValue(value: any) {
    const sprite = this._getSafeComponent(Sprite);
    if (!sprite) return;
    if (!value) {
      sprite.spriteFrame = null;
      return;
    }
    AssetScopeManager.setNodeSprite(sprite, value);
  }

  private _setToggleContainerValue(value: any) {
    const toggleContainer = this._getSafeComponent(ToggleContainer);
    if (!toggleContainer) return;
    const toggles = toggleContainer.getComponentsInChildren(Toggle);
    const index = this._toNumberValue(value);
    for (let i = 0; i < toggles.length; i++) {
      toggles[i].isChecked = i === index;
    }
  }

  private _bindEditBoxCallback() {
    const editBox = this._getSafeComponent(EditBox);
    if (!editBox) return;
    const callback = (currentEditBox: EditBox) => {
      this._elementValueChange?.(currentEditBox.string);
    };
    editBox.node.on(EditBox.EventType.TEXT_CHANGED, callback, this);
    this._addDisposer(() => {
      if (editBox && editBox.node && editBox.node.isValid) {
        editBox.node.off(EditBox.EventType.TEXT_CHANGED, callback, this);
      }
    });
  }

  private _bindToggleCallback() {
    const toggle = this._getSafeComponent(Toggle);
    if (!toggle) return;
    const callback = (currentToggle: Toggle) => {
      this._elementValueChange?.(currentToggle.isChecked);
    };
    toggle.node.on(Toggle.EventType.TOGGLE, callback, this);
    this._addDisposer(() => {
      if (toggle && toggle.node && toggle.node.isValid) {
        toggle.node.off(Toggle.EventType.TOGGLE, callback, this);
      }
    });
  }

  private _bindButtonCallback() {
    const button = this._getSafeComponent(Button);
    if (!button) return;
    const callback = () => {
      this._elementValueChange?.(this.customEventData);
    };
    button.node.on(Button.EventType.CLICK, callback, this);
    this._addDisposer(() => {
      if (button && button.node && button.node.isValid) {
        button.node.off(Button.EventType.CLICK, callback, this);
      }
    });
  }

  private _bindSliderCallback() {
    const slider = this._getSafeComponent(Slider);
    if (!slider) return;
    const callback = (currentSlider: Slider) => {
      this._elementValueChange?.(currentSlider.progress);
    };
    slider.node.on('slide', callback, this);
    this._addDisposer(() => {
      if (slider && slider.node && slider.node.isValid) {
        slider.node.off('slide', callback, this);
      }
    });
  }

  private _bindPageViewCallback() {
    const pageView = this._getSafeComponent(PageView);
    if (!pageView) return;
    const callback = (currentPageView: PageView) => {
      this._elementValueChange?.(currentPageView.getCurrentPageIndex());
    };
    pageView.node.on(PageView.EventType.PAGE_TURNING, callback, this);
    this._addDisposer(() => {
      if (pageView && pageView.node && pageView.node.isValid) {
        pageView.node.off(PageView.EventType.PAGE_TURNING, callback, this);
      }
    });
  }

  private _onToggleGroup(toggle: Toggle) {
    if (!toggle || !toggle.node) return;
    const parent: Node = toggle.node.parent;
    if (!parent || EDITOR) return;

    // 获取位置索引
    const index = parent.children.indexOf(toggle.node);
    this._elementValueChange?.(index);
  }

  private _bindToggleContainerCallback() {
    const container = this._getSafeComponent(ToggleContainer);
    if (!container) return;
    const exist = container.checkEvents.find((item) => {
      return item &&
        item.target === this.node &&
        item.component === CC_ELEMENT_CLASS_NAME &&
        item.handler === '_onToggleGroup';
    });
    if (exist) {
      this._addDisposer(() => {
        if (container && container.checkEvents && container.checkEvents.length > 0) {
          const index = container.checkEvents.indexOf(exist);
          if (index !== -1) {
            container.checkEvents.splice(index, 1);
          }
        }
      });
      return;
    }

    const containerEventHandler = new EventHandler();
    containerEventHandler.target = this.node;
    containerEventHandler.component = CC_ELEMENT_CLASS_NAME;
    containerEventHandler.handler = '_onToggleGroup';
    containerEventHandler.customEventData = '0';
    container.checkEvents.push(containerEventHandler);
    this._addDisposer(() => {
      if (container && container.checkEvents && container.checkEvents.length > 0) {
        const index = container.checkEvents.indexOf(containerEventHandler);
        if (index !== -1) {
          container.checkEvents.splice(index, 1);
        }
      }
    });
  }

  //#region Node get set value
  private _value: any = null!;
  private _setNodeActiveValue(value: any) {
    this.node.active = !!value;
  }

  private _setNodePositionValue(value: any) {
    this._value = value;
    if (!this._value) {
      this._value = { x: 0, y: 0, z: 0 };
    }
    const pos = this.node.position;
    pos.set(this._value.x, this._value.y, this._value.z);
    this.node.position = pos;
  }

  private _bindNodeActiveCallback() {
    const callback = () => {
      this._elementValueChange?.(this.node.active);
    };
    this.node.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, callback, this);
    this._addDisposer(() => {
      if (this.node && this.node.isValid) {
        this.node.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, callback, this);
      }
    });
  }

  private _bindNodePositionCallback() {
    const callback = () => {
      const currentPos = this.node.position;
      if (!this._value) {
        this._value = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
        this._elementValueChange?.(this._value);
        return;
      }

      // 仅在坐标变化时回调，避免高频无效通知。
      if (this._value.x === currentPos.x && this._value.y === currentPos.y && this._value.z === currentPos.z) {
        return;
      }
      // 这里使用 batch 包裹，避免在 x 更新后又立即触发下一个回调，导致y,z的值还是旧值。
      batch(() => {
        this._value.x = currentPos.x;
        this._value.y = currentPos.y;
        this._value.z = currentPos.z;
      });
      this._elementValueChange?.(this._value);
    };
    this.node.on(Node.EventType.TRANSFORM_CHANGED, callback, this);
    this._addDisposer(() => {
      if (this.node && this.node.isValid) {
        this.node.off(Node.EventType.TRANSFORM_CHANGED, callback, this);
      }
    });
  }

  private _bindNodeTouchCallback(eventType: string) {
    const callback = () => {
      this._elementValueChange?.(this.customEventData);
    };
    this.node.on(eventType, callback, this);
    this._addDisposer(() => {
      if (this.node && this.node.isValid) {
        this.node.off(eventType, callback, this);
      }
    });
  }

  private _setNodeCustomValue(value: any) {
    (this.node as any)[MVVM_NODE_TAG_KEY] = this._toStringValue(value);
  }

  //#endregion

  //#region Custom Component

  private _getUserComponents(): Component[] {
    const registryNames = this._elementRegistry
      .filter(e => e.component !== Node && e.component !== Component)
      .map(e => e.component.name);

    return this.node.getComponents(Component).filter(
      c => !(c instanceof CCElement)
        && !(c instanceof UITransform)
        && registryNames.indexOf(c.constructor.name) === -1
    );
  }

  private _hasUserComponent(): boolean {
    return this._getUserComponents().length > 0;
  }

  private _getUserComponent(): Component | null {
    const userComps = this._getUserComponents();
    if (userComps.length === 0) {
      console.warn(`PATH ${this.getNodePath()} 缺少用户自定义组件，绑定操作已忽略`);
      return null;
    }
    const comp = userComps.find(c => c.constructor.name === this._componentTargetName) || userComps[0];
    if (!comp) {
      console.warn(`PATH ${this.getNodePath()} 未找到组件 ${this._componentTargetName}，绑定操作已忽略`);
      return null;
    }
    return comp;
  }

  private _setComponentPropertyValue(value: any) {
    const comp = this._getUserComponent();
    if (!comp || !this._componentPropertyName) return;
    (comp as any)[this._componentPropertyName] = value;
  }
  //#endregion
}
