/**
 * CCLocatorLoop.ts - CCLocatorLoop 定位器（间隔循环查询）
 * @description 该类提供了一个基于间隔循环查询的节点定位器，支持分段名称查询和超时机制。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2023-02-27
 * @modified 2024-08-17
 */

import { director, Node } from 'cc';

export interface ILocateOptions {
  /** 定位超时时间（单位毫秒, 默认值为 5000） */
  timeout?: number;
  /** 定位超时判定间隔时间（单位毫秒，最小100，默认值为 100） */
  timeout_ms?: number;
  /** 是否允许返回未激活节点（默认 false） */
  includeInactive?: boolean;
}
const defaultLocateOptions: ILocateOptions = {
  timeout: 5000,
  timeout_ms: 100,
  includeInactive: false,
};

/** 定位器(间隔循环查询) */
export class CCLocatorLoop {
  /**
   * 定位解析（仅支持 '>' 分隔）
   * @param locator 定位地址
   * @returns 名称数组
   */
  private static parseLocatorTokens(locator: string): string[] {
    const tokens = locator.split('>').map((part) => part.trim());
    for (let i = 0; i < tokens.length; i++) {
      if (!tokens[i]) {
        return [];
      }
    }

    return tokens;
  }

  /**
   * 执行分段递归查询
   * @param root 根节点
   * @param tokens 解析后的分段名称
   * @returns Node | null
   */
  private static queryByTokens(root: Node, tokens: string[]): Node | null {
    if (!root || !root.isValid || tokens.length === 0) {
      return null;
    }

    let node: Node | null = root;
    for (let i = 0; i < tokens.length; i++) {
      if (!node || !node.isValid) {
        return null;
      }

      // 第一段允许命中当前 root；后续段仅在后代中查找，避免 A>A 命中同一个节点。
      node = i === 0
        ? this.seekNodeByNameBFS(node, tokens[i], true)
        : this.seekNodeByNameBFS(node, tokens[i], false);
      if (!node) {
        return null;
      }
    }

    return node;
  }

  /**
   * 定位节点循环查询
   * @param root 根节点
   * @param tokens 解析后的分段名称
   * @param start 定位开始时间
   * @param options 定位选项
   * @returns {Promise<Node | null>} 节点
   */
  private static async pollLocateNode(
    root: Node,
    tokens: string[],
    start: number,
    options: Required<ILocateOptions>,
  ): Promise<Node | null> {
    if (!root || !root.isValid) {
      return null;
    }

    // 节点查询（按 token 分段递归）
    const node = this.queryByTokens(root, tokens);

    // 节点返回
    if (node && (options.includeInactive || node.activeInHierarchy)) {
      return node;
    }
    else {
      if (Date.now() - start > options.timeout) {
        console.warn(`Locator timeout root=${this.getNodeFullPath(root)} locator=${tokens.join(' > ')}`);
        return null;
      }
      return await new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.pollLocateNode(root, tokens, start, options));
        }, options.timeout_ms);
      });
    }
  }

  /**
   * 定位节点(支持超时定位)
   * @param locator 定位地址（使用 '>' 分隔，按分段递归查询）
   * @param root 根节点（默认为 director.getScene() 场景根节点）
   * @param options 定位选项
   * timeout 定位超时时间（单位毫秒, 默认值为 5000）
   * timeout_ms 定位超时判定间隔时间（单位毫秒，最小100，默认值为 100）
   * includeInactive 是否允许返回未激活节点（默认 false）
   * @returns {Promise<Node | null>} 节点
   * @example
   * // locator 定位地址格式
   * // '>' 分段名称，每一段都在当前命中节点的子树中递归查找
   * // 例如: 'Content>Panel>Label-Name'
   * let node = await CCLocatorLoop.locateNode('Content>Label-Name', this.node);
   * let node = await CCLocatorLoop.locateNode('Content>Panel>Label-Name');
   */
  static async locateNode(locator: string, root?: Node, options?: ILocateOptions): Promise<Node | null> {
    if (!root || !root.isValid) {
      return null;
    }

    const mergedOptions = { ...defaultLocateOptions, ...options };
    const normalizedOptions: Required<ILocateOptions> = {
      timeout: Math.max(0, mergedOptions.timeout ?? defaultLocateOptions.timeout!),
      timeout_ms: Math.max(100, mergedOptions.timeout_ms ?? defaultLocateOptions.timeout_ms!),
      includeInactive: mergedOptions.includeInactive ?? defaultLocateOptions.includeInactive!,
    };

    const tokens = this.parseLocatorTokens(locator);
    if (tokens.length === 0) {
      console.warn('Locator parse failed: ' + locator);
      return null;
    }

    const start = Date.now();
    return this.pollLocateNode(root || director.getScene(), tokens, start, normalizedOptions);
  }

  /**
   * 寻找节点 - 广度优先搜索
   * @param root 根节点 
   * @param name 节点名称
   * @param includeSelf 是否包含 root 自身（默认包含）
   * @returns Node | null 节点
   */
  static seekNodeByNameBFS(root: Node, name: string, includeSelf: boolean = true): Node | null {
    // 检查根节点
    if (includeSelf && root.name === name) {
      return root;
    }

    // 使用队列存储待检查的节点
    const queue: Node[] = [...root.children];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // 检查当前节点
      if (current.name === name) {
        return current;
      }

      // 将当前节点的子节点加入队列尾部，保证按层级顺序检查
      queue.push(...current.children);
    }

    return null;
  }

  /**
   * 获取节点全路径
   * @param node 
   * @returns 节点全路径
   */
  static getNodeFullPath(node: Node): string {
    const names: string[] = [];
    let current: Node | null = node;
    while (current) {
      names.push(current.name);
      current = current.parent;
    }
    return names.reverse().join('/');
  }
}
