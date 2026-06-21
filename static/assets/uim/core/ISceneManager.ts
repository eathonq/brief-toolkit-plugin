/**
 * ISceneManager.ts — 场景管理接口
 * @description 定义场景加载、预加载和生命周期钩子的契约。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-10
 */

/**
 * 场景进入事件常量。
 *
 * @description SceneManager 在场景加载完成后同时 emit 两条路径：
 *              - `director.getScene().emit(SceneEvent, info)` — 场景内组件，节点销毁自动清理。
 *              - `EventBus.emit(SceneEvent, info)` — persist 节点 / 非 Cocos 上下文的全局观察者。
 *
 * @example
 * // ── 场景内组件（推荐）── 节点销毁自动清理，无需 onDestroy 中手动 off
 * class BattleUI extends Component {
 *   onLoad() {
 *     director.getScene().on(SceneEvent, (payload: SceneEventData) => {
 *       if (payload.toScene === 'BattleScene') {
 *         this.initWithData(payload.data);
 *       }
 *     }, this);
 *   }
 * }
 *
 * @example
 * // ── 全局观察者（persist 节点 / 非 Cocos 上下文）──
 * import { EventBus } from 'db://assets/brief-toolkit/common/pure';
 *
 * const token = EventBus.on(SceneEvent, (payload: SceneEventData) => {
 *   console.log(`[Analytics] ${payload.fromScene} → ${payload.toScene}`);
 * });
 */
export const SceneEvent = 'SCENE_EVENT';

/** 场景生命周期数据（EventBus SCENE_EVENT 事件 payload 类型） */
export interface SceneEventData {
  /** 即将离开的场景名 */
  fromScene: string;
  /** 即将进入的场景名 */
  toScene: string;
  /** loadScene 传入的自定义数据 */
  data?: any;
}

export interface ISceneManager {
  /**
   * 加载并切换到目标场景
   * @param name 场景名称
   * @param data 传递给目标场景的自定义数据
   */
  loadScene(name: string, data?: any): Promise<void>;

  /**
   * 预加载场景（后台加载资源，不切换）
   * @param name 场景名称
   */
  preloadScene(name: string): Promise<void>;
}
