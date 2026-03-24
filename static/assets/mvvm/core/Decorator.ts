/**
 * Decorator.ts - 装饰器
 * @description 该模块提供 MVVM 相关的装饰器，用于标记 ViewModel、Model、属性和方法等。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-03-02
 * @modified 2026-03-11
 */

import { decoratorData } from "./DecoratorData";

/**
 * 装饰器
 * @help https://vangagh.gitbook.io/brief-toolkit/mvvm/decorator
 */
export namespace _decorator {

  //#region vm
  /**
   * ViewModel 装饰器
   * @help https://vangagh.gitbook.io/brief-toolkit/mvvm/decorator
   * @param name ViewModel 名称
   * @param global 是否全局单例, 默认 false
   * @example
   * ```ts
   * // ViewModel 装饰器
   * .@vm('MyViewModel')
   * class MyViewModel {}
   * 
   * // 全局 ViewModel
   * .@vm('MyViewModel', true)
   * class MyViewModel {}
   * 
   * // 可以继承 IViewModel 接口，便捷重写 onLoad 和 onDestroy 方法（也可以直接重写）
   * .@vm('MyViewModel')
   * class MyViewModel implements IViewModel {
   *     onLoaded() {}  // 可重写 onLoad 方法
   *     onDestroy() {} // 可重写 onDestroy 方法
   * }
   * ```
   */
  export function vm(name: string, global?: boolean): ClassDecorator {
    return (target: Function) => {
      decoratorData.addViewModel(target, name, global);
    };
  }
  //#endregion

  //#region model
  /**
   * Model 装饰器
   * @help https://vangagh.gitbook.io/brief-toolkit/mvvm/decorator
   * @param name Model 名称
   * @example
   * ```ts
   * // Model 装饰器
   * .@model('MyModel')
   * class MyModel {}
   * ```
   */
  export function model(name: string): ClassDecorator {
    return (target: Function) => {
      decoratorData.addModel(target, name, false);
    };
  }
  //#endregion

  //#region prop

  /**
   * 属性装饰器
   * @help https://vangagh.gitbook.io/brief-toolkit/mvvm/decorator
   * @param type 类型可以是 String, Number, Boolean, [String] ...
   * @example
   * ```ts
   * // 无参装饰器，需要设置默认值
   * //（仅支持 string, number, boolean, string[], number[], boolean[]）
   * .@prop
   * myProperty: string = ""; // **这里需要设置默认值**
   * 
   * // 无参装饰器，同 @prop 写法
   * .@prop()
   * myProperty: string = ""; // **这里需要设置默认值**
   * 
   * // 有参装饰器，不需要设置默认值
   * .@prop(String)
   * myProperty: string;
   * ```
   */
  export function prop(type: any): PropertyDecorator;
  /**
   * 属性装饰器（兼容 @prop() 写法）
   */
  export function prop(): PropertyDecorator;
  /**
   * 属性装饰器
   * @help https://vangagh.gitbook.io/brief-toolkit/mvvm/decorator
   * @param target 
   * @param propertyKey 
   * @example
   * ```ts
   * // 无参装饰器，需要设置默认值
   * //（仅支持 string, number, boolean, string[], number[], boolean[]）
   * .@prop
   * myProperty: string = ""; // **这里需要设置默认值**
   * 
   * // 有参装饰器，不需要设置默认值
   * .@prop(String)
   * myProperty: string;
   * ```
   */
  export function prop(target: any, propertyKey: string | symbol): void;
  export function prop(...args: any[]) {
    if (args.length == 0) {
      return (target: any, propertyKey: string | symbol) => {
        decoratorData.addUnknownProperty(target.constructor, propertyKey);
      };
    }

    if (args.length == 1) {
      const arg_type = args[0];
      return (target: any, propertyKey: string | symbol) => {
        decoratorData.addProperty(target.constructor, propertyKey, arg_type);
      };
    }
    else {
      const target = args[0];
      const key = args[1];
      decoratorData.addUnknownProperty(target.constructor, key);
    }
  }
  //#endregion

  //#region func
  /**
   * mvvm 方法装饰器
   * @help https://vangagh.gitbook.io/brief-toolkit/mvvm/decorator
   * @example
   * ```ts
   * // 方法装饰器
   * .@func
   * myFunction() {}
   *
   * // 兼容写法
   * .@func()
   * myFunction() {}
   * ```
   */
  export function func(): MethodDecorator;
  export function func(target: any, key: string | symbol, descriptor: PropertyDescriptor): void;
  export function func(...args: any[]) {
    if (args.length == 0) {
      return (target: any, key: string | symbol, descriptor: PropertyDescriptor) => {
        decoratorData.addFunction(target.constructor, key);
      };
    }

    const target = args[0];
    const key = args[1];
    decoratorData.addFunction(target.constructor, key);
  }
  //#endregion

}