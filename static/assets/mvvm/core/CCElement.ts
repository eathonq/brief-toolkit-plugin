/**
 * CCElement.ts - Cocos Creator 元素组件
 * @description 该组件用于识别 Cocos Creator 中常用组件（如 Label、Button 等）或节点，
 * 并提供统一的接口设置值和监听事件变化，方便与 MVVM 框架的数据绑定。
 * @see {@link https://vangagh.gitbook.io/brief-toolkit/mvvm/ccelement}
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-03-02
 * @modified 2026-03-11
 */

import { _decorator, Component, Node, Label, RichText, EditBox, Toggle, Button, Slider, ProgressBar, PageView, Sprite, ToggleContainer, Enum, CCClass, EventHandler, CCString } from 'cc';
import { EDITOR } from 'cc/env';
import { DataKind } from './DecoratorData';
import { CCResources } from './CCResources';
import { batch } from './Reactive';

const { ccclass, property, help, executeInEditMode } = _decorator;

type ElementBinding = {
  name: string;
  kind: DataKind[];
  setValue?: (value: any) => void;
  bindCallback?: () => void;
};

type Element = {
  name: string;
  component: any;
  binding: ElementBinding[];
}

const CC_ELEMENT_CLASS_NAME = 'private.CCElement';

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
  private readonly _elementRegistry: Element[] = this.createElementRegistry();
  private _runtimeSetHandler: ((value: any) => void) | null = null;
  private _runtimeBindHandler: (() => void) | null = null;

  private createElementRegistry(): Element[] {
    return [
      {
        name: Label.name,
        component: Label,
        binding: [
          {
            name: 'string',
            kind: [DataKind.String, DataKind.Number, DataKind.Boolean],
            setValue: (value) => this.setLabelValue(value)
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
            setValue: (value) => this.setRichTextValue(value)
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
            setValue: (value) => this.setEditBoxValue(value),
            bindCallback: () => this.bindEditBoxCallback()
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
            setValue: (value) => this.setToggleValue(value),
            bindCallback: () => this.bindToggleCallback()
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
            bindCallback: () => this.bindButtonCallback()
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
            setValue: (value) => this.setSliderValue(value),
            bindCallback: () => this.bindSliderCallback()
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
            setValue: (value) => this.setProgressBarValue(value)
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
            setValue: (value) => this.setPageViewValue(value),
            bindCallback: () => this.bindPageViewCallback()
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
            setValue: (value) => this.setSpriteValue(value)
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
            setValue: (value) => this.setToggleContainerValue(value),
            bindCallback: () => this.bindToggleContainerCallback()
          }
        ]
      },
      {
        name: Node.name,
        component: Node,
        binding: [
          {
            name: 'active',
            kind: [DataKind.Boolean],
            setValue: (value) => this.setNodeActiveValue(value),
            bindCallback: () => this.bindNodeActiveCallback()
          },
          {
            name: 'position',
            kind: [DataKind.Vec],
            setValue: (value) => this.setNodePositionValue(value),
            bindCallback: () => this.bindNodePositionCallback()
          },
          {
            name: 'touch-start',
            kind: [DataKind.Function],
            bindCallback: () => this.bindNodeTouchCallback(Node.EventType.TOUCH_START)
          },
          {
            name: 'touch-move',
            kind: [DataKind.Function],
            bindCallback: () => this.bindNodeTouchCallback(Node.EventType.TOUCH_MOVE)
          },
          {
            name: 'touch-end',
            kind: [DataKind.Function],
            bindCallback: () => this.bindNodeTouchCallback(Node.EventType.TOUCH_END)
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

  private getSafeComponent<T>(component: new (...args: any[]) => T): T | null {
    const target = this.node.getComponent(component as any) as T | null;
    if (!target) {
      console.warn(`PATH ${this.getNodePath()} 缺少组件 ${component.name}，绑定操作已忽略`);
      return null;
    }
    return target;
  }

  private clearRuntimeListeners() {
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

  private addDisposer(disposer: () => void) {
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
      this.selectedComponent();
      this.refreshRuntimeHandlers();
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
      this.refreshRuntimeHandlers();
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
    this.checkEditorComponent();
  }

  protected checkEditorComponent() {
    this.identifyComponent();
    this.updateEditorElementEnums();
  }

  /** 识别到的组件列表 */
  private _identifyList: Element[] = [];
  private identifyComponent() {
    this._identifyList = [];
    for (let i = 0; i < this._elementRegistry.length; i++) {
      const element = this._elementRegistry[i];
      if (element.component === Node || this.node.getComponent(element.component)) {
        this._identifyList.push(element);
      }
    }
  }

  private updateEditorElementEnums() {
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

  private updateEditorPropertyEnums() {
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

  private selectedComponent() {
    this.updateEditorPropertyEnums();
  }

  protected selectedProperty() {
    const element = this._identifyList[this._bindingElement];
    if (element) {
      this._elementKinds = element.binding[this._bindingProperty].kind;
    }
    else {
      this._elementKinds = [];
    }
    this.refreshRuntimeHandlers();
  }
  //#endregion

  protected onLoad() {
    if (EDITOR) {
      this.checkEditorComponent();
      return;
    }

    this.refreshRuntimeHandlers();
  }

  protected onDestroy() {
    this.clearRuntimeListeners();
    this._runtimeSetHandler = null;
    this._runtimeBindHandler = null;
  }

  private getRuntimeBindingConfig(): ElementBinding | null {
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

  private refreshRuntimeHandlers() {
    const bindingConfig = this.getRuntimeBindingConfig();
    this._runtimeSetHandler = bindingConfig?.setValue ?? null;
    this._runtimeBindHandler = bindingConfig?.bindCallback ?? null;
  }

  protected setElementValue(value: any) {
    if (!this._runtimeSetHandler) {
      return;
    }
    this._runtimeSetHandler(value);
  }

  private _elementValueChange: (value: any) => void = null;
  protected onElementCallback(elementValueChange: (value: any) => void) {
    this.clearRuntimeListeners();
    this._elementValueChange = elementValueChange;
    if (!this._runtimeBindHandler) {
      return;
    }
    this._runtimeBindHandler();
  }

  private toStringValue(value: any): string {
    if (value === undefined || value === null) {
      return "";
    }
    return `${value}`;
  }

  private toNumberValue(value: any, fallback = 0): number {
    if (value === undefined || value === null) {
      return fallback;
    }
    return Number(value);
  }

  private setLabelValue(value: any) {
    const label = this.getSafeComponent(Label);
    if (!label) return;
    label.string = this.toStringValue(value);
  }

  private setRichTextValue(value: any) {
    const richText = this.getSafeComponent(RichText);
    if (!richText) return;
    richText.string = this.toStringValue(value);
  }

  private setEditBoxValue(value: any) {
    const editBox = this.getSafeComponent(EditBox);
    if (!editBox) return;
    editBox.string = this.toStringValue(value);
  }

  private setToggleValue(value: any) {
    const toggle = this.getSafeComponent(Toggle);
    if (!toggle) return;
    toggle.isChecked = Boolean(value);
  }

  private setSliderValue(value: any) {
    const slider = this.getSafeComponent(Slider);
    if (!slider) return;
    slider.progress = this.toNumberValue(value);
  }

  private setProgressBarValue(value: any) {
    const progressBar = this.getSafeComponent(ProgressBar);
    if (!progressBar) return;
    progressBar.progress = this.toNumberValue(value);
  }

  private setPageViewValue(value: any) {
    const pageView = this.getSafeComponent(PageView);
    if (!pageView) return;

    const index = this.toNumberValue(value);

    // 使用 Promise 或 nextTick 延迟到下一帧执行
    Promise.resolve().then(() => {
      if (this.node && pageView.isValid) {
        pageView.setCurrentPageIndex(index);
      }
    });
  }

  private setSpriteValue(value: any) {
    const sprite = this.getSafeComponent(Sprite);
    if (!sprite) return;
    if (!value) {
      sprite.spriteFrame = null;
      return;
    }
    CCResources.setSprite(sprite, value);
  }

  private setToggleContainerValue(value: any) {
    const toggleContainer = this.getSafeComponent(ToggleContainer);
    if (!toggleContainer) return;
    const toggles = toggleContainer.getComponentsInChildren(Toggle);
    const index = this.toNumberValue(value);
    for (let i = 0; i < toggles.length; i++) {
      toggles[i].isChecked = i === index;
    }
  }

  private bindEditBoxCallback() {
    const editBox = this.getSafeComponent(EditBox);
    if (!editBox) return;
    const callback = (currentEditBox: EditBox) => {
      this._elementValueChange?.(currentEditBox.string);
    };
    editBox.node.on(EditBox.EventType.TEXT_CHANGED, callback, this);
    this.addDisposer(() => {
      editBox.node.off(EditBox.EventType.TEXT_CHANGED, callback, this);
    });
  }

  private bindToggleCallback() {
    const toggle = this.getSafeComponent(Toggle);
    if (!toggle) return;
    const callback = (currentToggle: Toggle) => {
      this._elementValueChange?.(currentToggle.isChecked);
    };
    toggle.node.on(Toggle.EventType.TOGGLE, callback, this);
    this.addDisposer(() => {
      toggle.node.off(Toggle.EventType.TOGGLE, callback, this);
    });
  }

  private bindButtonCallback() {
    const button = this.getSafeComponent(Button);
    if (!button) return;
    const callback = () => {
      this._elementValueChange?.(this.customEventData);
    };
    button.node.on(Button.EventType.CLICK, callback, this);
    this.addDisposer(() => {
      button.node.off(Button.EventType.CLICK, callback, this);
    });
  }

  private bindSliderCallback() {
    const slider = this.getSafeComponent(Slider);
    if (!slider) return;
    const callback = (currentSlider: Slider) => {
      this._elementValueChange?.(currentSlider.progress);
    };
    slider.node.on('slide', callback, this);
    this.addDisposer(() => {
      slider.node.off('slide', callback, this);
    });
  }

  private bindPageViewCallback() {
    const pageView = this.getSafeComponent(PageView);
    if (!pageView) return;
    const callback = (currentPageView: PageView) => {
      this._elementValueChange?.(currentPageView.getCurrentPageIndex());
    };
    pageView.node.on(PageView.EventType.PAGE_TURNING, callback, this);
    this.addDisposer(() => {
      pageView.node.off(PageView.EventType.PAGE_TURNING, callback, this);
    });
  }

  private onToggleGroup(toggle: Toggle) {
    if (!toggle || !toggle.node) return;
    const parent: Node = toggle.node.parent;
    if (!parent || EDITOR) return;

    // 获取位置索引
    const index = parent.children.indexOf(toggle.node);
    this._elementValueChange?.(index);
  }

  private bindToggleContainerCallback() {
    const container = this.getSafeComponent(ToggleContainer);
    if (!container) return;
    const exist = container.checkEvents.find((item) => {
      return item &&
        item.target === this.node &&
        item.component === CC_ELEMENT_CLASS_NAME &&
        item.handler === 'onToggleGroup';
    });
    if (exist) {
      this.addDisposer(() => {
        const index = container.checkEvents.indexOf(exist);
        if (index !== -1) {
          container.checkEvents.splice(index, 1);
        }
      });
      return;
    }

    const containerEventHandler = new EventHandler();
    containerEventHandler.target = this.node;
    containerEventHandler.component = CC_ELEMENT_CLASS_NAME;
    containerEventHandler.handler = 'onToggleGroup';
    containerEventHandler.customEventData = '0';
    container.checkEvents.push(containerEventHandler);
    this.addDisposer(() => {
      const index = container.checkEvents.indexOf(containerEventHandler);
      if (index !== -1) {
        container.checkEvents.splice(index, 1);
      }
    });
  }

  //#region Node get set value
  private _value: any = null;
  private setNodeActiveValue(value: any) {
    this.node.active = !!value;
  }

  private setNodePositionValue(value: any) {
    this._value = value;
    if (!this._value) {
      this._value = { x: 0, y: 0, z: 0 };
    }
    const pos = this.node.position;
    pos.set(this._value.x, this._value.y, this._value.z);
    this.node.position = pos;
  }

  private bindNodeActiveCallback() {
    const callback = () => {
      this._elementValueChange?.(this.node.active);
    };
    this.node.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, callback, this);
    this.addDisposer(() => {
      this.node.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, callback, this);
    });
  }

  private bindNodePositionCallback() {
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
    this.addDisposer(() => {
      this.node.off(Node.EventType.TRANSFORM_CHANGED, callback, this);
    });
  }

  private bindNodeTouchCallback(eventType: string) {
    const callback = () => {
      this._elementValueChange?.(this.customEventData);
    };
    this.node.on(eventType, callback, this);
    this.addDisposer(() => {
      this.node.off(eventType, callback, this);
    });
  }

  //#endregion
}
