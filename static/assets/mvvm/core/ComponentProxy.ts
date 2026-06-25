/**
 * ComponentProxy.ts - 组件代理
 * @description 通过 CCElement 绑定到指定组件后，ViewModel 可通过此对象
 * 调用组件上的任意方法（同步/异步）。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-25
 */

export class ComponentProxy {
  private _comp: any;

  constructor(comp: any) {
    this._comp = comp;
  }

  call(funcName: string, ...args: any[]): any {
    const method = (this._comp as any)[funcName];
    if (typeof method !== 'function') {
      console.warn(`[ComponentProxy] ${funcName} 不是函数`);
      return undefined;
    }
    return method.apply(this._comp, args);
  }

  async asyncCall(funcName: string, ...args: any[]): Promise<any> {
    const method = (this._comp as any)[funcName];
    if (typeof method !== 'function') {
      console.warn(`[ComponentProxy] ${funcName} 不是函数`);
      return undefined;
    }
    return method.apply(this._comp, args);
  }
}
