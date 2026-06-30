/**
 * HttpTemplate.ts - 泛型类型安全 API 模板
 * @description 通过泛型 ServerData 定义完整 API 接口契约（路径、参数、返回值），
 *              提供编译期类型检查与 IDE 智能提示的 get/post/put/patch/delete 方法。
 *
 *              依赖 IHttp 传输接口（由 HttpClient 实现），通过依赖注入解耦。
 *              所有方法永不抛出异常，统一返回 ResData<T> 信封（code 判断成功/失败）。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-30
 */

import type { IHttp } from './HttpClient';

// ──────────── 通用数据类型 ────────────

/** 返回数据信封 */
export interface ResData<T> {
  /**
   * 状态码
   * - 0: 成功
   * - -1: 业务失败
   * - -2: 请求异常（网络错误 / 超时 / HTTP 错误）
   */
  code: number;
  /** 错误消息 */
  message?: string;
  /** 响应数据 */
  data?: T;
}

/** 分页查询参数 */
export interface PaginateQuery {
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 全文搜索 */
  search?: string;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方式 */
  sortOrder?: 'ASC' | 'DESC';
  /** 是否激活 */
  isActive?: boolean;
}

/** 分页响应数据 */
export interface PaginatedResponse<T> {
  /** 当前页数据列表 */
  data: T[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

/** 短列表数据项 */
export interface ListSortItem {
  id: number;
  name: string;
}

// ──────────── ServerData 接口 ────────────

/** 服务器 API 接口定义 —— 描述完整 HTTP 接口契约 */
export interface IServerData {
  /** GET 请求 */
  get?: {
    /** api 路径 → 请求/响应映射 */
    [api: string]: {
      /** 请求参数 */
      req: {
        /** 路径参数（替换 :paramName） */
        params?: any;
        /** 查询参数（拼接 ?key=value） */
        query?: any;
      };
      /** 返回值 */
      res: ResData<any>;
    };
  };
  /** POST 请求 */
  post?: {
    [api: string]: {
      req: {
        params?: any;
        query?: any;
        /** 请求体 */
        body?: any;
      };
      res: ResData<any>;
    };
  };
  /** PUT 请求 */
  put?: {
    [api: string]: {
      req: {
        params?: any;
        query?: any;
        body?: any;
      };
      res: ResData<any>;
    };
  };
  /** PATCH 请求 */
  patch?: {
    [api: string]: {
      req: {
        params?: any;
        query?: any;
        body?: any;
      };
      res: ResData<any>;
    };
  };
  /** DELETE 请求 */
  delete?: {
    [api: string]: {
      req: {
        params?: any;
        query?: any;
      };
      res: ResData<any>;
    };
  };
}

// ──────────── 实现 ────────────

/**
 * 泛型 HTTP 请求模板
 *
 * 使用示例：
 * ```typescript
 * interface MyAPI extends IServerData {
 *   get: {
 *     'users/:id': {
 *       req: { params: { id: string } };
 *       res: ResData<{ name: string }>;
 *     };
 *   };
 * }
 * export const api = new HttpTemplate<MyAPI>(httpClient, 'api/users');
 * const res = await api.get('users/:id', { params: { id: '123' } });
 * ```
 */
export class HttpTemplate<ServerData extends IServerData> {
  /** 全局基础 URL，所有实例共享 */
  static baseUrl: string = 'http://127.0.0.1:3000';

  private _apiPrefix: string = '';
  private _instance: IHttp;

  /**
   * @param instance  IHttp 传输实例（如 httpClient 单例）
   * @param apiPrefix API 路径前缀（自动去首尾斜杠）
   */
  constructor(instance: IHttp, apiPrefix?: string) {
    this._instance = instance;
    if (apiPrefix) {
      this._apiPrefix = apiPrefix.replace(/^\/+|\/+$/g, '');
    }
  }

  /**
   * 构建完整请求 URL
   * 格式：{baseUrl}/{apiPrefix}/{path}?{queryString}
   * 其中 path 中的 :paramName 会被 req.params 中同名属性替换
   */
  buildUrl(path: string, req: any): string {
    // 去掉首部斜杠
    path = path.replace(/^\/+/, '');

    // 替换路径参数 :paramName
    if (req && req.params) {
      path = path.replace(/:([a-zA-Z_]+)/g, (_match: string, key: string) => {
        return req.params[key];
      });
    }

    // 拼接查询参数（过滤 null / undefined）
    if (req && req.query) {
      const keys = Object.keys(req.query).filter(
        key => req.query[key] !== null && req.query[key] !== undefined,
      );
      if (keys.length > 0) {
        path += `?${keys.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(req.query[key])}`).join('&')}`;
      }
    }

    const apiBaseUrl = HttpTemplate.baseUrl.replace(/\/+$/, '');
    return `${apiBaseUrl}/${this._apiPrefix}/${path}`;
  }

  /** 处理成功响应 */
  private handleResponse(res: any): ResData<any> {
    return {
      code: 0,
      data: res.data,
    };
  }

  /** 处理错误响应（匹配 axios 错误格式） */
  private handleError(error: any): ResData<any> {
    if (error.response && error.response.data) {
      let errorMessage = error.response.data.message;
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join(', ');
      }
      return {
        code: -2,
        message: errorMessage || '请求异常',
      };
    }
    console.error('HTTP Error:', error);
    return {
      code: -2,
      message: error.message || '请求异常',
    };
  }

  // ────── 类型安全的 HTTP 方法 ──────

  // @ts-ignore TS 对嵌套泛型索引访问的已知限制，原始 temp_demo 同样处理
  async get<T extends string & keyof ServerData['get']>(
    api: T,
    // @ts-ignore
    req: ServerData['get'][T]['req'],
    config?: Record<string, any>,
    // @ts-ignore
  ): Promise<ServerData['get'][T]['res']> {
    const path = this.buildUrl(api as string, req);
    try {
      const res = await this._instance.get(path, config);
      return this.handleResponse(res) as any;
    } catch (error: any) {
      return this.handleError(error) as any;
    }
  }

  async post<T extends string & keyof ServerData['post']>(
    api: T,
    // @ts-ignore
    req: ServerData['post'][T]['req'],
    config?: Record<string, any>,
    // @ts-ignore
  ): Promise<ServerData['post'][T]['res']> {
    const path = this.buildUrl(api as string, req);
    try {
      const res = await this._instance.post(path, (req as any).body, config);
      return this.handleResponse(res) as any;
    } catch (error: any) {
      return this.handleError(error) as any;
    }
  }

  async put<T extends string & keyof ServerData['put']>(
    api: T,
    // @ts-ignore
    req: ServerData['put'][T]['req'],
    config?: Record<string, any>,
    // @ts-ignore
  ): Promise<ServerData['put'][T]['res']> {
    const path = this.buildUrl(api as string, req);
    try {
      const res = await this._instance.put(path, (req as any).body, config);
      return this.handleResponse(res) as any;
    } catch (error: any) {
      return this.handleError(error) as any;
    }
  }

  async patch<T extends string & keyof ServerData['patch']>(
    api: T,
    // @ts-ignore
    req: ServerData['patch'][T]['req'],
    config?: Record<string, any>,
    // @ts-ignore
  ): Promise<ServerData['patch'][T]['res']> {
    const path = this.buildUrl(api as string, req);
    try {
      const res = await this._instance.patch(path, (req as any).body, config);
      return this.handleResponse(res) as any;
    } catch (error: any) {
      return this.handleError(error) as any;
    }
  }

  async delete<T extends string & keyof ServerData['delete']>(
    api: T,
    // @ts-ignore
    req: ServerData['delete'][T]['req'],
    config?: Record<string, any>,
    // @ts-ignore
  ): Promise<ServerData['delete'][T]['res']> {
    const path = this.buildUrl(api as string, req);
    try {
      const res = await this._instance.delete(path, config);
      return this.handleResponse(res) as any;
    } catch (error: any) {
      return this.handleError(error) as any;
    }
  }
}
