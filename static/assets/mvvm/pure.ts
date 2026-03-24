/**
 * pure.ts - MVVM 纯 TS 装饰器入口
 * @description 该模块提供MVVM（Model-View-ViewModel）相关的纯 TypeScript 装饰器，帮助开发者实现数据绑定和视图更新。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2026-03-10
 * @modified 2026-03-13
 */

export { _decorator } from './core/Decorator';
export { decoratorData, ExpandType } from './core/DecoratorData';

//#region SetEditor
import { decoratorData } from "./core/DecoratorData";
/**
 * 编辑器模式下设置显示数据
 * @param data 
 */
export function SetEditor(data: any) {
  decoratorData.setDefaultInEditor(data);
}
//#endregion

export {
  batch,
  computed,
  isProxy,
  isReactive,
  isReadonly,
  reactive,
  readonly,
  setReactiveErrorHandler,
  shallowReactive,
  shallowReadonly,
  toRaw,
  watch,
  watchEffect,
} from './core/Reactive';

/** ViewModel 默认方法接口 */
export interface IViewModel {
  /**
   * 加载完成后调用（ViewModel.onLoad 的下一帧执行，保证UI数据已经准备好）
   */
  onLoaded?(): void;
  /** 销毁时调用 */
  onDestroy?(): void;
  /** 每帧更新时调用 */
  onUpdate?(deltaTime: number): void;
}

