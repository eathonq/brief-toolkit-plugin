/**
 * GuideInteractionHandler.ts - 引导交互处理器
 * @description 负责 trigger 解析、条件校验、交互监听与分发。
 *              从 GuideStepAction 中拆分，保持交互逻辑内聚。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-11
 */

import { Button, EditBox, Label, Node, PageView, ProgressBar, Slider, Sprite, Toggle, ToggleContainer } from 'cc';
import { GuideStep, StepTriggerType } from './IGuideManager';

type IdentifyElement = { component: any };

/** 清理函数注册回调（由 GuideStepAction 注入，维护清理链） */
type AddCleanupFn = (fn: () => void) => void;

/**
 * 引导交互处理器
 *
 * 职责：
 *   - 节点组件识别与 trigger 解析
 *   - 步骤条件校验（toggle_index / property_equal）
 *   - 按 trigger 类型分发交互监听
 */
export class GuideInteractionHandler {
  private readonly _elementRegistry: IdentifyElement[] = this._createRegistry();
  private _addCleanup: AddCleanupFn;

  constructor(addCleanup: AddCleanupFn) {
    this._addCleanup = addCleanup;
  }

  // ── 组件注册与识别 ──

  /**
   * 组件注册表，按优先级排列：
   *   1. 有特殊 trigger 映射的组件排前面（EditBox → input_done 等）
   *   2. 可能被 property_equal 校验属性的组件
   *   3. Node 兜底（始终匹配，放最后）
   */
  private _createRegistry(): IdentifyElement[] {
    return [
      { component: EditBox },
      { component: ToggleContainer },
      { component: Toggle },
      { component: Button },
      { component: Slider },
      { component: ProgressBar },
      { component: PageView },
      { component: Sprite },
      { component: Label },
      { component: Node },
    ];
  }

  /**
   * 识别节点上匹配的组件。
   * 遍历 _elementRegistry 按优先级返回列表。
   */
  identifyComponent(node: Node): IdentifyElement[] {
    const list: IdentifyElement[] = [];
    for (const element of this._elementRegistry) {
      if (node.getComponent(element.component)) {
        list.push(element);
      }
    }
    return list;
  }

  // ── Trigger 解析 ──

  /** 从组件类型推断默认 trigger */
  private _inferTriggerFrom(comp: any): StepTriggerType {
    switch (comp) {
      case EditBox:
        return 'input_done';
      case Slider:
        return 'slide';
      case ToggleContainer:
        return 'toggle';
      case PageView:
        return 'page_turn';
      case Button:
      default:
        return 'click';
    }
  }

  /**
   * 解析有效 trigger：step.trigger > 组件推断 > 'click' 兜底
   */
  resolveTrigger(node: Node, step: GuideStep): StepTriggerType {
    if (step.trigger) return step.trigger;
    const list = this.identifyComponent(node);
    if (list.length > 0) return this._inferTriggerFrom(list[0].component);
    return 'click';
  }

  // ── 条件校验 ──

  /** 无 condition 直接通过，有则按 type 分发 */
  private _checkCondition(node: Node, step: GuideStep): boolean {
    const cond = step.condition;
    if (!cond) return true;

    switch (cond.type) {
      case 'toggle_index':
        return this._checkToggleIndex(node, cond.params);
      case 'page_index':
        return this._checkPageIndex(node, cond.params);
      case 'property_equal':
        return this._checkPropertyEqual(node, cond.params);
      default:
        return true;
    }
  }

  /** 校验 ToggleContainer 选中 index */
  private _checkToggleIndex(node: Node, params?: Record<string, any>): boolean {
    const tc = node.getComponent(ToggleContainer);
    if (!tc) return true;
    const idx = params?.index as number;
    if (idx === undefined) return true;
    return tc.toggleItems.findIndex(t => t.isChecked) === idx;
  }

  /** 校验 PageView 当前页 index */
  private _checkPageIndex(node: Node, params?: Record<string, any>): boolean {
    const pv = node.getComponent(PageView);
    if (!pv) return true;
    const idx = params?.index as number;
    if (idx === undefined) return true;
    return pv.getCurrentPageIndex() === idx;
  }

  /**
   * 校验节点上某组件的属性值。
   * 遍历 _elementRegistry 查找拥有该属性的组件并比较。
   *
   * @param params.property 属性名
   * @param params.operator  比较运算符（默认 'eq'）
   * @param params.value     目标值（notEmpty 时不需要）
   * @param params.tolerance 数值容差（默认 0，仅 eq/neq 生效）
   */
  private _checkPropertyEqual(node: Node, params?: Record<string, any>): boolean {
    const prop = params?.property as string;
    if (!prop) return true;

    const operator = (params?.operator as string) ?? 'eq';

    for (const element of this._elementRegistry) {
      const comp = node.getComponent(element.component);
      if (comp && prop in comp) {
        return this._compareValue(comp[prop], operator, params);
      }
    }
    return true; // 未找到属性，放行
  }

  /** 按 operator 比较 actual 与 params.value */
  private _compareValue(actual: any, operator: string, params?: Record<string, any>): boolean {
    const value = params?.value;
    const tolerance = (params?.tolerance as number) ?? 0;

    switch (operator) {
      case 'notEmpty':
        return actual !== null && actual !== undefined && actual !== '';

      case 'neq':
        if (typeof actual === 'number' && typeof value === 'number') {
          return Math.abs(actual - value) > tolerance;
        }
        return actual !== value;

      case 'gt':
        return typeof actual === 'number' && typeof value === 'number' && actual > value;
      case 'gte':
        return typeof actual === 'number' && typeof value === 'number' && actual >= value;
      case 'lt':
        return typeof actual === 'number' && typeof value === 'number' && actual < value;
      case 'lte':
        return typeof actual === 'number' && typeof value === 'number' && actual <= value;

      case 'eq':
      default:
        if (typeof actual === 'number' && typeof value === 'number') {
          return Math.abs(actual - value) <= tolerance;
        }
        return actual === value;
    }
  }

  /**
   * 校验条件 → 通过则 done()。
   * @returns true 表示条件通过且已调用 done()
   */
  private _tryComplete(node: Node, step: GuideStep, done: () => void): boolean {
    if (!this._checkCondition(node, step)) return false;
    done();
    return true;
  }

  // ── 触发动作 ──

  /** click: 监听 TOUCH_END，每次松开时 _tryComplete */
  private _doClick(node: Node, step: GuideStep, done: () => void): void {
    const handler = () => this._tryComplete(node, step, done);
    node.on(Node.EventType.TOUCH_END, handler);
    this._addCleanup(() => node.off(Node.EventType.TOUCH_END, handler));
  }

  /**
   * input_done: EditBox 退出编辑态（失焦/回车）时 _tryComplete。
   * fired 旗标防止双事件重复触发；_tryComplete 失败时重置 fired 允许重试。
   */
  private _doInputDone(node: Node, step: GuideStep, done: () => void): void {
    const editBox = node.getComponent(EditBox);
    if (!editBox) {
      console.warn(`GuideInteractionHandler: EditBox not found on ${node.name}`);
      done();
      return;
    }

    let fired = false;
    const handler = () => {
      if (fired) return;
      if (!this._tryComplete(node, step, done)) return;
      fired = true;
    };

    editBox.node.on(EditBox.EventType.EDITING_DID_ENDED, handler);
    editBox.node.on(EditBox.EventType.EDITING_RETURN, handler);
    this._addCleanup(() => {
      editBox.node.off(EditBox.EventType.EDITING_DID_ENDED, handler);
      editBox.node.off(EditBox.EventType.EDITING_RETURN, handler);
    });
  }

  /**
   * slide: Slider 交互触发。监听 Slider 节点 + Handle 两个 TOUCH_END，
   * 松手时 _tryComplete。双监听双触发由 done() 幂等守卫兜底。
   */
  private _doSlide(node: Node, step: GuideStep, done: () => void): void {
    const handler = () => this._tryComplete(node, step, done);

    // 节点级：覆盖点击背景条
    node.on(Node.EventType.TOUCH_END, handler);
    this._addCleanup(() => node.off(Node.EventType.TOUCH_END, handler));

    // Handle 级：覆盖拖拽 Handle（其 Button 会拦截事件冒泡）
    const slider = node.getComponent(Slider);
    const handleNode = slider?.handle?.node;
    if (handleNode) {
      handleNode.on(Node.EventType.TOUCH_END, handler);
      this._addCleanup(() => handleNode.off(Node.EventType.TOUCH_END, handler));
    }
  }

  /**
   * toggle: ToggleContainer 交互触发。监听容器所有 toggleItems 子节点的
   * TOUCH_END，点击任意 Toggle 后 _tryComplete。
   */
  private _doToggle(node: Node, step: GuideStep, done: () => void): void {
    const handler = () => this._tryComplete(node, step, done);

    // 容器节点
    // node.on(Node.EventType.TOUCH_END, handler);
    // this._addCleanup(() => node.off(Node.EventType.TOUCH_END, handler));

    // 所有子 Toggle（点击不冒泡到容器）
    const tc = node.getComponent(ToggleContainer);
    if (tc) {
      for (const toggle of tc.toggleItems) {
        toggle.node.on(Node.EventType.TOUCH_END, handler);
        this._addCleanup(() => toggle.node.off(Node.EventType.TOUCH_END, handler));
      }
    }
  }

  /**
   * page_turn: PageView 翻页触发。监听 PAGE_TURNING 事件，
   * 页面切换完成后 _tryComplete。
   */
  private _doPageTurn(node: Node, step: GuideStep, done: () => void): void {
    const pageView = node.getComponent(PageView);
    if (!pageView) {
      done();
      return;
    }

    const handler = () => this._tryComplete(node, step, done);
    pageView.node.on(PageView.EventType.PAGE_TURNING, handler);
    this._addCleanup(() => pageView.node.off(PageView.EventType.PAGE_TURNING, handler));
  }

  /**
   * 按 trigger 分发交互处理。
   * 由 GuideStepAction.runStep 在完成聚焦/显示后调用。
   */
  dispatch(trigger: StepTriggerType, node: Node, step: GuideStep, done: () => void): void {
    switch (trigger) {
      case 'input_done':
        this._doInputDone(node, step, done);
        break;
      case 'slide':
        this._doSlide(node, step, done);
        break;
      case 'toggle':
        this._doToggle(node, step, done);
        break;
      case 'page_turn':
        this._doPageTurn(node, step, done);
        break;
      case 'click':
      default:
        this._doClick(node, step, done);
        break;
    }
  }
}
