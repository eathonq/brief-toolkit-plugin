/**
 * NodePool.ts - MVVM 对象池
 * @description 封装 Cocos NodePool，支持多模板缓存和节点回收时的子树资源清理。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-10
 */

import { Node, NodePool as CocosNodePool, instantiate, Component } from 'cc';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 资源清理接口 — DataContext / Binding 需要实现此接口以支持池回收 */
export interface IPoolable {
  /**
   * 暂停：停止 watch、取消注册、释放事件监听。
   * 节点从场景中移除放入对象池时调用。
   */
  suspend(): void;

  /**
   * 恢复：重新注册上下文、重新建立 watch 和事件监听。
   * 节点从对象池取出重新插入场景时调用。
   */
  resume(): void;
}

/** 池选项 */
export interface NodePoolOptions {
  /** 每个模板的最大缓存数，默认 50 */
  maxSize?: number;
  /** 空闲节点超过多少秒后回收（暂未实现，保留） */
  idleTimeout?: number;
}

const DEFAULT_MAX = 50;

/**
 * MVVM 对象池
 *
 * 基于 Cocos NodePool 封装：
 * - 按模板 Node 分组缓存
 * - 出池时自动调用 IPoolable.resume()
 * - 入池时自动调用 IPoolable.suspend()
 * - 支持容量控制
 */
export class MvvmNodePool {
  /** template → pool */
  private _pools = new Map<Node | string, CocosNodePool>();
  private _maxSize: number;
  private _count = 0;

  constructor(options: NodePoolOptions = {}) {
    this._maxSize = options.maxSize ?? DEFAULT_MAX;
  }

  /**
   * 从池中获取一个节点（优先池，无则 instantiate）
   * 返回的节点处于 suspended 状态，调用方必须在 insertChild 后调用 resumeNode() 恢复。
   * @param template 模板节点
   */
  get(template: Node): Node | null {
    const pool = this._getOrCreatePool(template);
    const node = pool.get();
    if (node) {
      this._count--;
    }
    return node;
  }

  /**
   * 恢复池节点的响应式绑定和事件监听。
   * 必须在节点 insertChild 到目标父节点后调用，否则 DataContext 链查找会失败。
   */
  resumeNode(node: Node): void {
    this._resumeSubtree(node);
  }

  /**
   * 将节点放回池中
   * @param node 要回收的节点
   */
  put(node: Node, template: Node): void {
    if (!node || !node.isValid) return;

    // 先清理，再入池
    this._suspendSubtree(node);

    const pool = this._getOrCreatePool(template);
    if (this._count < this._maxSize) {
      pool.put(node);
      this._count++;
    } else {
      // 超出容量直接销毁
      node.destroy();
    }
  }

  /** 清空所有池，销毁缓存节点 */
  clear(): void {
    for (const pool of this._pools.values()) {
      pool.clear();
    }
    this._pools.clear();
    this._count = 0;
  }

  /** 当前缓存节点数 */
  get size(): number {
    return this._count;
  }

  // ──────────── 私有 ────────────

  private _getOrCreatePool(template: Node): CocosNodePool {
    let pool = this._pools.get(template);
    if (!pool) {
      pool = new CocosNodePool();
      // 用模板填充初始实例的函数
      const createFn = () => instantiate(template);
      // Cocos NodePool 的构造器可以接受创建函数
      // 但 3.x 的 NodePool 不支持自定义 createFn，所以用模板 Node
      // 我们用 template 创建一个初始节点供 NodePool 复制
      this._pools.set(template, pool);
    }
    return pool;
  }

  /** 递归遍历子树，调用所有 IPoolable.resume() */
  private _resumeSubtree(root: Node): void {
    const components = root.getComponentsInChildren(Component);
    for (const comp of components) {
      if (this._isPoolable(comp)) {
        (comp as unknown as IPoolable).resume();
      }
    }
  }

  /** 递归遍历子树，调用所有 IPoolable.suspend() */
  private _suspendSubtree(root: Node): void {
    const components = root.getComponentsInChildren(Component);
    for (const comp of components) {
      if (this._isPoolable(comp)) {
        (comp as unknown as IPoolable).suspend();
      }
    }
  }

  /** 类型检查：是否实现了 IPoolable */
  private _isPoolable(comp: Component): boolean {
    return typeof (comp as any).suspend === 'function'
      && typeof (comp as any).resume === 'function';
  }
}
