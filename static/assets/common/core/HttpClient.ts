/**
 * HttpClient.ts - 基于 XMLHttpRequest 的 HTTP 客户端
 * @description 零依赖、全平台（Web / Native / 小游戏）可用的 Promise 风格 HTTP 请求封装。
 *              底层使用 XMLHttpRequest（Cocos Creator 3.8.8 在所有构建目标均已内置适配层，
 *              小游戏平台内部转发至 wx.request / tt.request 等原生接口）。
 *
 *              提供请求/响应拦截器链，用于统一注入 Auth Header、处理错误等。
 *              导出单例 httpClient，所有 API 模块共享同一实例。
 *
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 *
 * @created 2026-06-30
 */

// ──────────── 接口定义 ────────────

/** HTTP 请求配置 */
export interface IHttpConfig {
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 超时时间（ms），默认 30000 */
  timeout?: number;
  /** 响应类型（用于二进制数据） */
  responseType?: XMLHttpRequestResponseType;
}

/** HTTP 请求拦截器 */
export interface IHttpInterceptor {
  /** 请求拦截：可修改 config，返回修改后的 config */
  request?: (config: IHttpConfig) => IHttpConfig;
  /** 响应拦截：可修改 response，返回修改后的 response */
  response?: (response: any) => any;
  /** 错误拦截：可修改 error，返回修改后的 error */
  error?: (error: any) => any;
}

/** HTTP 传输接口 —— HttpTemplate 依赖此接口进行类型安全的 API 调用 */
export interface IHttp {
  get(url: string, config?: IHttpConfig): Promise<any>;
  post(url: string, data: any, config?: IHttpConfig): Promise<any>;
  put(url: string, data: any, config?: IHttpConfig): Promise<any>;
  patch(url: string, data: any, config?: IHttpConfig): Promise<any>;
  delete(url: string, config?: IHttpConfig): Promise<any>;
}

// ──────────── 实现 ────────────

/** 默认请求超时（ms） */
const DEFAULT_TIMEOUT = 30000;

/**
 * HTTP 客户端（基于 XMLHttpRequest）
 *
 * 使用示例：
 *   httpClient.baseUrl = 'https://api.example.com';
 *   httpClient.addInterceptor({ request: (c) => { c.headers.Authorization = 'Bearer xxx'; return c; } });
 *   const res = await httpClient.get('/users');
 */
class HttpClient implements IHttp {
  /** 全局基础 URL，设置后所有请求自动拼接此前缀 */
  static baseUrl: string = '';

  private _timeout: number = DEFAULT_TIMEOUT;
  private _interceptors: IHttpInterceptor[] = [];

  // ────── 拦截器管理 ──────

  /** 添加拦截器 */
  addInterceptor(interceptor: IHttpInterceptor): void {
    this._interceptors.push(interceptor);
  }

  /** 移除拦截器 */
  removeInterceptor(interceptor: IHttpInterceptor): void {
    const idx = this._interceptors.indexOf(interceptor);
    if (idx !== -1) this._interceptors.splice(idx, 1);
  }

  /** 清空所有拦截器 */
  clearInterceptors(): void {
    this._interceptors.length = 0;
  }

  // ────── 核心请求方法 ──────

  /** 发起请求 */
  private _request(method: string, url: string, data?: any, config?: IHttpConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      // 1) 拼接完整 URL
      let fullUrl: string;
      if (HttpClient.baseUrl) {
        const base = HttpClient.baseUrl.replace(/\/+$/, '');
        const path = url.replace(/^\/+/, '');
        fullUrl = `${base}/${path}`;
      } else {
        fullUrl = url;
      }

      // 2) 执行请求拦截器
      let mergedConfig: IHttpConfig = { timeout: this._timeout, ...config };
      for (const interceptor of this._interceptors) {
        if (interceptor.request) {
          mergedConfig = interceptor.request(mergedConfig);
        }
      }

      // 3) 创建 XMLHttpRequest
      const xhr = new XMLHttpRequest();
      xhr.open(method, fullUrl, true);
      xhr.timeout = mergedConfig.timeout ?? this._timeout;

      // 4) Content-Type（如未在 headers 中显式设置，默认 application/json）
      const hasContentType = mergedConfig.headers &&
        Object.keys(mergedConfig.headers).some(k => k.toLowerCase() === 'content-type');
      if (!hasContentType) {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }

      // 5) 应用 headers
      if (mergedConfig.headers) {
        const headerKeys = Object.keys(mergedConfig.headers);
        for (const key of headerKeys) {
          xhr.setRequestHeader(key, mergedConfig.headers[key]);
        }
      }

      // 6) 响应类型
      if (mergedConfig.responseType) {
        xhr.responseType = mergedConfig.responseType;
      }

      // 7) 事件处理
      xhr.onload = () => {
        let body: any;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = xhr.responseText;
        }

        // 包装为 axios 兼容的 response 对象
        let response = {
          data: body,
          status: xhr.status,
          statusText: xhr.statusText,
        };

        // 执行响应拦截器
        for (const interceptor of this._interceptors) {
          if (interceptor.response) {
            response = interceptor.response(response);
          }
        }

        if (xhr.status >= 200 && xhr.status < 400) {
          resolve(response);
        } else {
          const rejectError: any = { response };
          if (body && body.message) {
            rejectError.message = body.message;
          } else {
            rejectError.message = `HTTP ${xhr.status}`;
          }
          reject(rejectError);
        }
      };

      xhr.onerror = () => {
        let error: any = { message: 'Network Error' };
        for (const interceptor of this._interceptors) {
          if (interceptor.error) {
            error = interceptor.error(error);
          }
        }
        reject(error);
      };

      xhr.ontimeout = () => {
        const error: any = { message: 'Request Timeout' };
        reject(error);
      };

      // 8) 发送
      if (data !== undefined && ['POST', 'PUT', 'PATCH'].indexOf(method) !== -1) {
        xhr.send(JSON.stringify(data));
      } else {
        xhr.send();
      }
    });
  }

  // ────── HTTP 方法 ──────

  get(url: string, config?: IHttpConfig): Promise<any> {
    return this._request('GET', url, undefined, config);
  }

  post(url: string, data: any, config?: IHttpConfig): Promise<any> {
    return this._request('POST', url, data, config);
  }

  put(url: string, data: any, config?: IHttpConfig): Promise<any> {
    return this._request('PUT', url, data, config);
  }

  patch(url: string, data: any, config?: IHttpConfig): Promise<any> {
    return this._request('PATCH', url, data, config);
  }

  delete(url: string, config?: IHttpConfig): Promise<any> {
    return this._request('DELETE', url, undefined, config);
  }
}

/** 全局单例 —— 所有 API 模块共享 */
export const httpClient = new HttpClient();
