/**
 * BaseViewModel.ts - 视图模型基类
 * @description 提供完整的 ViewModel 生命周期钩子。
 *
 * @author eathonq
 * @license MIT
 * @version v1.2.0
 *
 * @created 2026-06-09
 * @modified 2026-06-10
 */

/**
 * ViewModel 基类
 *
 * 所有 ViewModel 必须继承此类，使用 @vm 装饰器注册。
 * 生命周期方法均为可选覆盖，框架在合适时机调用。
 *
 * @example
 * ```ts
 * @vm('MyVM')
 * class MyVM extends BaseViewModel {
 *   @prop count = 0;
 *
 *   onLoaded(): void {
 *     MessageBus.on('score-update', (s) => this.count += s);
 *   }
 * }
 * ```
 */
export abstract class BaseViewModel {
  // ──────────── 生命周期 ────────────

  /** 构造完成后调用（在 reactive 包装之前） */
  onCreate(): void { }

  /** 数据绑定完成 + 首帧渲染前调用 */
  onLoaded(): void { }

  /** 所在节点 activeInHierarchy 变为 true 时调用 */
  onEnable(): void { }

  /** 所在节点 activeInHierarchy 变为 false 时调用 */
  onDisable(): void { }

  /** 每帧更新 */
  onUpdate(_deltaTime: number): void { }

  /** 销毁前调用（适合取消订阅、释放资源） */
  onDestroy(): void { }

  /** 应用从后台回到前台时调用 */
  onAppShow(): void { }

  /** 应用从前台进入后台时调用 */
  onAppHide(): void { }

  /** ViewModel 内部发生未捕获异常时调用 */
  onError(_error: unknown): void { }
}
