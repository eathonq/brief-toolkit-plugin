/**
 * MvvmType.ts - 类型工具
 * @description 提供 MVVM 框架的 TypeScript 类型推导工具，弥补 Cocos Component 无法使用泛型类的限制。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-09
 */

/**
 * 从 ViewModel 构造函数提取实例类型
 *
 * @example
 * ```ts
 * class MyVM extends BaseViewModel {
 *   @prop title = '';
 *   @prop count = 0;
 * }
 * type MyVMInstance = ViewModelOf<typeof MyVM>; // MyVM
 * ```
 */
export type ViewModelOf<T extends abstract new (...args: any[]) => any> = InstanceType<T>;

/**
 * 提取对象上指定键的属性类型
 *
 * @example
 * ```ts
 * type TitleType = PropType<MyVM, 'title'>; // string
 * type CountType = PropType<MyVM, 'count'>; // number
 * ```
 */
export type PropType<T, K extends keyof T> = T[K];

/**
 * 提取对象上所有值为特定类型的键
 *
 * @example
 * ```ts
 * type StringKeys = KeysOfType<MyVM, string>; // 'title'
 * ```
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * 提取对象上所有函数类型的键
 *
 * @example
 * ```ts
 * type FuncKeys = FunctionKeys<MyVM>; // 'onClick' | 'onSubmit'
 * ```
 */
export type FunctionKeys<T> = KeysOfType<T, Function>;

/**
 * 提取对象上所有非函数属性类型的键（适合作为绑定路径）
 *
 * @example
 * ```ts
 * type BindableKeys = BindingKeys<MyVM>; // 'title' | 'count'
 * ```
 */
export type BindingKeys<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/**
 * 嵌套路径类型 — 支持一层深度如 'user.name'
 *
 * @example
 * ```ts
 * type Paths = DeepPath<MyVM>; // 'title' | 'count' | 'user.name' | 'user.age'
 * ```
 */
export type DeepPath<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends object
    ? T[K] extends Array<any>
      ? `${Prefix}${K}`
      : `${Prefix}${K}` | DeepPath<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

/**
 * 类型安全的 Binding.Data 辅助类型
 *
 * @example
 * ```ts
 * const data = BindingData.get<MyVM>(someNode); // data: MyVM | null
 * ```
 */
export interface TypedBinding<T, K extends keyof T = keyof T> {
  readonly dataContext: T;
  readonly bindingName: K;
  readonly bindingType: string;
}

/**
 * 类型安全的 watch 回调类型（与 watch<T> 重载配合使用）
 *
 * @example
 * ```ts
 * type Callback = WatchCallbackFor<number>; // (value: number, oldValue: number | undefined) => void
 * ```
 */
export type WatchCallbackFor<T> = (value: T, oldValue: T | undefined) => void;
