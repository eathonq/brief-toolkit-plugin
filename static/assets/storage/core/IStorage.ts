/**
 * IStorage.ts - 存储后端接口
 * @description 定义存储后端的原始操作接口，Storage 模块在此基础上封装 JSON 序列化与错误降级。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-16
 */

/** 存储后端接口（原始字符串操作） */
export interface IStorageBackend {
  /** 读取 */
  getItem(key: string): string | null;
  /** 写入 */
  setItem(key: string, value: string): void;
  /** 删除 */
  removeItem(key: string): void;
  /** 列出所有 key（可选，不支持时返回空数组） */
  keys?(): string[];
  /** 清空所有数据（可选） */
  clear?(): void;
}
