/**
 * Reactive.ts - 响应式系统
 * @description 该模块提供一个轻量级的响应式系统，支持对象和数组的深度响应式、浅响应式、只读响应式等多种模式，
 * 并提供依赖追踪和更新机制。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2025-03-10
 * @modified 2026-03-11
 */

/** 原始对象 */
type Raw = object;
/** 响应式对象 */
type ReactiveProxy = object;

/** 存储原始对象到 deep reactive 代理对象的映射 */
const rawToProxy = new WeakMap<Raw, ReactiveProxy>();
/** 存储原始对象到 shallow reactive 代理对象的映射 */
const rawToShallowProxy = new WeakMap<Raw, ReactiveProxy>();
/** 存储原始对象到 deep readonly 代理对象的映射 */
const rawToReadonlyProxy = new WeakMap<Raw, ReactiveProxy>();
/** 存储原始对象到 shallow readonly 代理对象的映射 */
const rawToShallowReadonlyProxy = new WeakMap<Raw, ReactiveProxy>();

/** 存储代理对象到原始对象的映射（覆盖所有代理类型） */
const proxyToRaw = new WeakMap<ReactiveProxy, Raw>();

/** 代理类型标记 */
const reactiveProxies = new WeakSet<object>();
const readonlyProxies = new WeakSet<object>();

const globalObj = typeof window === "object" ? window : Function("return this")();
// 一些排除的内置对象
const excludedBuiltIns = new Set([
  Object,
  Array,
  Int8Array, Uint8Array, Uint8ClampedArray,
  Int16Array, Uint16Array,
  Int32Array, Uint32Array,
  Float32Array, Float64Array,
  Map, Set, WeakMap, WeakSet,
]);

/** 对于内置的一些对象不去处理 */
function shouldInstrument({ constructor }: Raw) {
  const isBuiltIn =
    typeof constructor === 'function' &&
    constructor.name in globalObj &&
    globalObj[constructor.name] === constructor;
  return !isBuiltIn || excludedBuiltIns.has(constructor as any);
}

/** 响应依赖的的函数 */
interface ReactionFunction {
  (operation?: ReactionOperation): void;
  deps: Set<ReactionFunction>[];
  active: boolean;
  paused: boolean;
  scheduler?: (operation?: ReactionOperation) => void;
}

/** 相应依赖触发更新参数 */
export interface ReactionOperation {
  /**
   * 操作的目标对象
   */
  target?: any;
  /**
   * 操作类型
   */
  type?: string;
  /**
   * 操作的属性名
   */
  property?: string | symbol;

  /**
   * 对象变化的新值
   */
  value?: any;
  /**
   * 对象变化的旧值
   */
  oldValue?: any;

  /**
   * 数组操作的插入值
   */
  inserted?: any[];
  /**
   * 数组操作的插入值的起始位置
   */
  insertedStart?: number;
  /**
   * 数组操作的删除值
   */
  deleted?: any[];
  /**
   * 数组操作的删除值的起始位置
   */
  deletedStart?: number;
}

/** Watch 源类型 */
type WatchSource =
  | (() => any) // getter 函数
  | ReactiveProxy; // 响应式对象

type WatchCallback = (operation?: ReactionOperation) => void;

/** Watch 选项 */
export interface WatchOptions {
  /**
   * 是否立即执行 callback，默认 false
   * - true: 立即执行一次 callback，并传入 undefined 作为 operation 参数
   * - false: 只有在依赖变更时才执行 callback，并传入变更信息作为 operation 参数
   */
  immediate?: boolean;
  /**
   * 回调触发时机
   * - sync: 同步触发（默认）
   * - post: 放入微任务队列，合并同一轮同步变更
   */
  flush?: 'sync' | 'post';
}

/** watchEffect 选项 */
export interface WatchEffectOptions {
  /**
   * 回调触发时机
   * - sync: 同步触发（默认）
   * - post: 放入微任务队列，合并同一轮同步变更
   */
  flush?: 'sync' | 'post';
}

/** 异步调度错误处理函数 */
export type ReactiveErrorHandler = (error: unknown) => void;

let reactiveErrorHandler: ReactiveErrorHandler | undefined;

/** 设置响应式系统错误处理函数（主要用于 flush='post' 的异步回调错误）。 */
export function setReactiveErrorHandler(handler?: ReactiveErrorHandler) {
  reactiveErrorHandler = handler;
}

function handleReactiveError(error: unknown) {
  if (reactiveErrorHandler) {
    reactiveErrorHandler(error);
    return;
  }
  // 无外部处理器时，保留默认报错行为。
  console.error(error);
}

/**
 * API 语义约定：
 * - computed: lazy，依赖变更仅标脏，读取 `.value` 时重算并缓存
 * - watch/watchEffect: 默认 sync；`flush: 'post'` 时按微任务合并同一轮同步变更
 */

/** 定义 WatchHandle 接口 */
export interface WatchHandle {
  (): void; // 可调用，与 `stop` 相同
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/** 存储依赖关系的映射 */
const rawToReaction = new WeakMap<Raw, Map<PropertyKey, Set<ReactionFunction>>>();

/** 统一的迭代依赖键，用于对象键枚举与集合遍历 */
const ITERATE_KEY = Symbol('iterate');

/** 当前活动的响应函数栈 */
const reactionStack: ReactionFunction[] = [];

/** 全局标记，控制是否自动收集依赖 */
let shouldTrack = true;

/** 批处理深度（支持嵌套 batch） */
let batchDepth = 0;

/** 批处理期间暂存待执行的响应函数，重复触发时保留最后一次 operation */
const batchedReactions = new Map<ReactionFunction, ReactionOperation | undefined>();

/** 创建包裹的响应函数 */
function createReactionWrap(
  fn: Function,
  scheduler?: (operation?: ReactionOperation) => void
): ReactionFunction {
  const reaction = ((operation?: ReactionOperation) => {
    // 如果暂停或不活跃则不执行
    if (reaction.paused || !reaction.active) return;

    // 如果已经在栈中，避免循环调用
    if (reactionStack.indexOf(reaction) !== -1) return;

    // 清理旧的依赖关系
    // 把上次收集到的依赖清空 重新收集依赖
    // 这点对于函数内有分支的情况很重要
    // 保证每次收集的都是确实能访问到的依赖
    cleanupReactionDependencies(reaction);

    try {
      reactionStack.push(reaction);
      fn(operation);
    } finally {
      reactionStack.pop();
    }

  }) as ReactionFunction;

  reaction.deps = [];
  reaction.active = true;
  reaction.paused = false;
  reaction.scheduler = scheduler;
  return reaction;
}

/** 
 * 清理响应函数的所有依赖关系
 * @param reaction 要清理的响应函数
 */
function cleanupReactionDependencies(reaction: ReactionFunction) {
  for (const dep of reaction.deps) {
    dep.delete(reaction);
  }
  reaction.deps.length = 0;
}

/** 
 * 追踪依赖
 * @param target 目标对象
 * @param key 目标属性
 */
function track(target: object, key: string | symbol): void {
  if (reactionStack.length === 0 || !shouldTrack) return;

  let depsMap = rawToReaction.get(target);
  if (!depsMap) {
    depsMap = new Map();
    rawToReaction.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  // 从栈中获取当前活动的响应函数
  const activeReaction = reactionStack[reactionStack.length - 1];
  if (!dep.has(activeReaction)) {
    dep.add(activeReaction);
    activeReaction.deps.push(dep);
  }
}

/**
 * 触发更新
 * @param target 目标对象 
 * @param key 目标属性
 * @param operation 变化信息
 */
function trigger(target: object, key: string | symbol, operation?: ReactionOperation): void {
  const depsMap = rawToReaction.get(target);
  if (!depsMap) return;

  const depsSet = depsMap.get(key);
  if (depsSet) {
    // 创建副本避免无限循环
    const reactionsToRun = new Set<ReactionFunction>();
    depsSet.forEach(reaction => {
      if (reaction.active && !reaction.paused) {
        reactionsToRun.add(reaction);
      }
    });

    // 执行收集到的响应函数（带 scheduler 时优先走调度器）
    reactionsToRun.forEach(reaction => {
      if (batchDepth > 0) {
        batchedReactions.set(reaction, operation);
      } else {
        if (reaction.scheduler) {
          reaction.scheduler(operation);
        } else {
          reaction(operation);
        }
      }
    });
  }
}

/** 执行并清空当前批处理队列 */
function flushBatchedReactions() {
  if (batchedReactions.size === 0) return;

  const queued = Array.from(batchedReactions.entries());
  batchedReactions.clear();

  queued.forEach(([reaction, operation]) => {
    if (!reaction.active || reaction.paused) return;
    if (reaction.scheduler) {
      reaction.scheduler(operation);
    } else {
      reaction(operation);
    }
  });
}

/**
 * 批量更新：在函数内触发的响应更新会在外层 batch 结束后统一执行。
 * 嵌套 batch 只在最外层退出时 flush。
 */
export function batch<T>(fn: () => T): T {
  batchDepth += 1;
  try {
    return fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      flushBatchedReactions();
    }
  }
}

/** 创建 post 模式调度器：同一轮同步变更仅执行一次，且使用最后一次 operation。 */
function createPostScheduler(run: (operation?: ReactionOperation) => void) {
  let pending = false;
  let latestOperation: ReactionOperation | undefined;

  return (operation?: ReactionOperation) => {
    latestOperation = operation;
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => {
      pending = false;
      try {
        run(latestOperation);
      } catch (error) {
        handleReactiveError(error);
      }
      latestOperation = undefined;
    });
  };
}

/**
 * 触发数组索引区间依赖。
 * 包含 start 与 end 两端，且会自动跳过非法区间。
 */
function triggerArrayIndexRange(target: any[], start: number, end: number, operation?: ReactionOperation): void {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  const from = Math.max(0, Math.floor(start));
  const to = Math.floor(end);
  if (from > to) return;

  for (let i = from; i <= to; i++) {
    trigger(target, String(i), operation);
  }
}

function warnReadonly(type: string, key?: PropertyKey) {
  const suffix = key !== undefined ? ` on key '${String(key)}'` : '';
  console.warn(`[Reactive] Cannot ${type}${suffix} on readonly proxy.`);
}

function unwrapRaw<T extends object>(value: T): T {
  return (proxyToRaw.get(value) as T) || value;
}

function getProxyCache(isReadonly: boolean, shallow: boolean) {
  if (isReadonly) {
    return shallow ? rawToShallowReadonlyProxy : rawToReadonlyProxy;
  }
  return shallow ? rawToShallowProxy : rawToProxy;
}

function wrapValueByMode(value: any, isReadonly: boolean, shallow: boolean) {
  if (shallow || typeof value !== 'object' || value === null) {
    return value;
  }
  return isReadonly ? readonly(value) : reactive(value);
}

/** 数组方法重写 */
const arrayInstrumentations: Record<string, Function> = {
  push: function (this: any[], ...args: any[]) {
    const oldLength = this.length;
    const result = Array.prototype.push.apply(this, args);

    // 收集数组变化信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'push',
      inserted: args,
      insertedStart: this.length - args.length,
    };

    trigger(this, 'length', operation);
    triggerArrayIndexRange(this, oldLength, this.length - 1, operation);
    return result;
  },
  pop: function (this: any[]) {
    const oldLength = this.length;
    const result = Array.prototype.pop.call(this);

    // 收集数组变化信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'pop',
      deleted: [result],
      deletedStart: this.length,
    };

    trigger(this, 'length', operation);
    triggerArrayIndexRange(this, this.length, oldLength - 1, operation);
    return result;
  },
  shift: function (this: any[]) {
    const oldLength = this.length;
    const result = Array.prototype.shift.call(this);

    // 收集数组变化信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'shift',
      deleted: [result],
      deletedStart: 0,
    };

    trigger(this, 'length', operation);
    triggerArrayIndexRange(this, 0, oldLength - 1, operation);
    return result;
  },
  unshift: function (this: any[], ...args: any[]) {
    const oldLength = this.length;
    const result = Array.prototype.unshift.apply(this, args);

    // 收集数组变化信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'unshift',
      inserted: args,
      insertedStart: 0,
    };

    trigger(this, 'length', operation);
    triggerArrayIndexRange(this, 0, Math.max(oldLength, this.length) - 1, operation);
    return result;
  },
  splice: function (this: any[], start: number, deleteCount?: number, ...items: any[]) {
    const oldLength = this.length;
    const normalizedStart = start < 0 ? Math.max(oldLength + start, 0) : Math.min(start, oldLength);

    const effectiveDeleteCount =
      deleteCount === undefined
        ? oldLength - normalizedStart
        : Math.max(0, Math.min(deleteCount, oldLength - normalizedStart));

    //@ts-ignore
    const deletedItems = Array.prototype.splice.apply(this, [start, deleteCount, ...items]);

    // 收集数组变化信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'splice',
      inserted: items,
      insertedStart: normalizedStart,
      deleted: deletedItems,
      deletedStart: normalizedStart,
    };

    trigger(this, 'length', operation);
    const end = Math.max(
      oldLength - 1,
      this.length - 1,
      normalizedStart + Math.max(effectiveDeleteCount, items.length) - 1
    );
    triggerArrayIndexRange(this, normalizedStart, end, operation);
    return deletedItems;
  }
};

const readonlyArrayInstrumentations: Record<string, Function> = {
  push: function () {
    warnReadonly('push');
    return (this as any[]).length;
  },
  pop: function () {
    warnReadonly('pop');
    return undefined;
  },
  shift: function () {
    warnReadonly('shift');
    return undefined;
  },
  unshift: function () {
    warnReadonly('unshift');
    return (this as any[]).length;
  },
  splice: function () {
    warnReadonly('splice');
    return [];
  },
};

/** 数组访问器处理  */
const arrayAccessors = {
  length: function (this: any[], value: number) {
    // 直接设置 length 属性
    const oldValue = this.length;
    if (oldValue === value) {
      return true;
    }

    let deletedItems: any[] = [];
    if (value < oldValue) {
      deletedItems = Array.prototype.slice.call(this, value, oldValue);
    }

    this.length = value;

    // 收集数组长度变化信息
    const operation: ReactionOperation = {
      target: this,
      type: 'set-length',
      oldValue,
      value,
      deleted: deletedItems,
      deletedStart: value < oldValue ? value : undefined,
    };
    trigger(this, 'length', operation);
    if (value < oldValue) {
      triggerArrayIndexRange(this, value, oldValue - 1, operation);
    }

    return true;
  },
};

/** Map 方法重写 */
const mapInstrumentations: Record<string | symbol, Function> = {
  has: function (this: Map<any, any>, key: any) {
    track(this, key);
    return Map.prototype.has.call(this, key);
  },
  set: function (this: Map<any, any>, key: any, value: any) {
    const hadKey = this.has(key);
    const oldValue = this.get(key);
    const result = Map.prototype.set.call(this, key, value);
    if (!hadKey || oldValue !== value) {
      // 收集 Map 变化信息
      const operation: ReactionOperation = {
        target: toRaw(this),
        type: hadKey ? 'set' : 'add',
        property: key,
        value,
        oldValue,
      };

      trigger(this, 'size', operation);
      trigger(this, key, operation);
      if (!hadKey) {
        trigger(this, ITERATE_KEY, operation);
      }
    }
    return result;
  },
  delete: function (this: Map<any, any>, key: any) {
    const hadKey = this.has(key);
    const oldValue = this.get(key);
    const result = Map.prototype.delete.call(this, key);
    if (hadKey) {
      // 收集 Map 删除信息
      const operation: ReactionOperation = {
        target: toRaw(this),
        type: 'delete',
        property: key,
        oldValue,
      };

      trigger(this, 'size', operation);
      trigger(this, key, operation);
      trigger(this, ITERATE_KEY, operation);
    }
    return result;
  },
  clear: function (this: Map<any, any>) {
    const keys = Array.from(this.keys());
    const entries = Array.from(this.entries());
    const result = Map.prototype.clear.call(this);

    // 收集 Map 清空信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'clear',
      oldValue: entries,
    };

    keys.forEach(key => {
      trigger(this, key, operation);
    });
    trigger(this, 'size', operation);
    trigger(this, ITERATE_KEY, operation);
    return result;
  },
  get: function (this: Map<any, any>, key: any) {
    track(this, key);
    //return Map.prototype.has.call(this, key);
    // 调用原型链上的get方法求值 然后对于复杂类型继续定义成响应式
    return findReactive(Map.prototype.get.call(this, key));
  },
  forEach: function (this: Map<any, any>, callback: Function, thisArg?: any) {
    track(this, ITERATE_KEY);
    // wrappedCb包裹了用户自己传给forEach的cb函数，然后传给了集合对象原型链上的forEach，这又是一个函数劫持。
    // 用户传入的是map.forEach(cb)，而我们最终调用的是map.forEach(wrappedCb)。  
    // 在这个wrappedCb中，我们把cb中本应该获得的原始值value通过`findObservable`定义成响应式数据交给用户，
    // 这样用户在forEach中进行的响应式操作一样可以收集到依赖了。 
    const wrappedCb = (value: any, ...rest: any[]) => callback(findReactive(value), ...rest);
    return Map.prototype.forEach.call(this, wrappedCb, thisArg);
  },
  keys: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    return Map.prototype.keys.call(this);
  },
  values: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    //return Map.prototype.values.call(this);
    const iterator = Map.prototype.values.call(this);
    return reactiveIterator(iterator, false);
  },
  entries: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    //return Map.prototype.entries.call(this);
    const iterator = Map.prototype.entries.call(this);
    return reactiveIterator(iterator, true);
  },
  [Symbol.iterator]: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    // return Map.prototype[Symbol.iterator].call(this);
    const iterator = Map.prototype[Symbol.iterator].call(this);
    return reactiveIterator(iterator, true);
  },
};

/** shallow reactive 的 Map 方法重写（仅顶层响应，不深度包装 value） */
const shallowMapInstrumentations: Record<string | symbol, Function> = {
  ...mapInstrumentations,
  get: function (this: Map<any, any>, key: any) {
    track(this, key);
    return Map.prototype.get.call(this, key);
  },
  forEach: function (this: Map<any, any>, callback: Function, thisArg?: any) {
    track(this, ITERATE_KEY);
    return Map.prototype.forEach.call(this, callback, thisArg);
  },
  values: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    return Map.prototype.values.call(this);
  },
  entries: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    return Map.prototype.entries.call(this);
  },
  [Symbol.iterator]: function (this: Map<any, any>) {
    track(this, ITERATE_KEY);
    return Map.prototype[Symbol.iterator].call(this);
  },
};

function createReadonlyMapInstrumentations(shallow: boolean): Record<string | symbol, Function> {
  const wrap = (value: any) => wrapValueByMode(value, true, shallow);

  return {
    has: function (this: Map<any, any>, key: any) {
      track(this, key);
      return Map.prototype.has.call(this, key);
    },
    get: function (this: Map<any, any>, key: any) {
      track(this, key);
      return wrap(Map.prototype.get.call(this, key));
    },
    forEach: function (this: Map<any, any>, callback: Function, thisArg?: any) {
      track(this, ITERATE_KEY);
      const wrappedCb = (value: any, ...rest: any[]) => callback(wrap(value), ...rest);
      return Map.prototype.forEach.call(this, wrappedCb, thisArg);
    },
    keys: function (this: Map<any, any>) {
      track(this, ITERATE_KEY);
      return Map.prototype.keys.call(this);
    },
    values: function (this: Map<any, any>) {
      track(this, ITERATE_KEY);
      const iterator = Map.prototype.values.call(this);
      return shallow ? iterator : reactiveIterator(iterator, false, wrap);
    },
    entries: function (this: Map<any, any>) {
      track(this, ITERATE_KEY);
      const iterator = Map.prototype.entries.call(this);
      return shallow ? iterator : reactiveIterator(iterator, true, wrap);
    },
    [Symbol.iterator]: function (this: Map<any, any>) {
      track(this, ITERATE_KEY);
      const iterator = Map.prototype[Symbol.iterator].call(this);
      return shallow ? iterator : reactiveIterator(iterator, true, wrap);
    },
    set: function (this: Map<any, any>) {
      warnReadonly('set');
      return this;
    },
    delete: function () {
      warnReadonly('delete');
      return false;
    },
    clear: function () {
      warnReadonly('clear');
      return undefined;
    },
  };
}

const readonlyMapInstrumentations = createReadonlyMapInstrumentations(false);
const shallowReadonlyMapInstrumentations = createReadonlyMapInstrumentations(true);

/** 把iterator劫持成响应式的iterator */
function reactiveIterator<T>(
  iterator: any,
  isEntries: boolean,
  wrap: (value: any) => any = findReactive
) {
  const originalNext = iterator.next;
  iterator.next = () => {
    let { done, value } = originalNext.call(iterator);
    if (!done) {
      if (isEntries) {
        value[1] = wrap(value[1]);
      } else {
        value = wrap(value);
      }
    }
    return { done, value };
  }
  return iterator;
}

/** 查找并返回响应式对象 */
function findReactive(raw: Raw) {
  if (typeof raw !== 'object' || raw === null) {
    return raw;
  }
  const proxy = rawToProxy.get(raw);
  // 只有正在运行观察函数的时候才去定义响应式
  // 避免不必要的响应式对象创建
  if (reactionStack.length > 0 && (typeof raw === 'object' && raw !== null)) {
    if (proxy) {
      return proxy;
    }
    return reactive(raw);
  }
  return proxy || raw;
}

/** Set 方法重写 */
const setInstrumentations: Record<string, Function> = {
  add: function (this: Set<any>, value: any) {
    const hadValue = this.has(value);
    const result = Set.prototype.add.call(this, value);

    if (!hadValue) {
      // 收集 Set 添加信息
      const operation: ReactionOperation = {
        target: toRaw(this),
        type: 'add',
        value,
      };

      trigger(this, 'size', operation);
      trigger(this, value, operation);
      trigger(this, ITERATE_KEY, operation);
    }
    return result;
  },
  delete: function (this: Set<any>, value: any) {
    const hadValue = this.has(value);
    const result = Set.prototype.delete.call(this, value);

    if (hadValue) {
      // 收集 Set 删除信息
      const operation: ReactionOperation = {
        target: toRaw(this),
        type: 'delete',
        value,
      };

      trigger(this, 'size', operation);
      trigger(this, value, operation);
      trigger(this, ITERATE_KEY, operation);
    }
    return result;
  },
  clear: function (this: Set<any>) {
    const values = Array.from(this.values());
    const result = Set.prototype.clear.call(this);

    // 收集 Set 清空信息
    const operation: ReactionOperation = {
      target: toRaw(this),
      type: 'clear',
      oldValue: values,
    };

    values.forEach((value: any) => {
      trigger(this, value, operation);
    });
    trigger(this, 'size', operation);
    trigger(this, ITERATE_KEY, operation);
    return result;
  },
  has: function (this: Set<any>, value: any) {
    track(this, value);
    return Set.prototype.has.call(this, value);
  }
};

function createReadonlySetInstrumentations(shallow: boolean): Record<string | symbol, Function> {
  const wrap = (value: any) => wrapValueByMode(value, true, shallow);

  return {
    has: function (this: Set<any>, value: any) {
      track(this, value);
      return Set.prototype.has.call(this, value);
    },
    forEach: function (this: Set<any>, callback: Function, thisArg?: any) {
      track(this, ITERATE_KEY);
      const wrappedCb = (value: any, ...rest: any[]) => callback(wrap(value), ...rest);
      return Set.prototype.forEach.call(this, wrappedCb, thisArg);
    },
    values: function (this: Set<any>) {
      track(this, ITERATE_KEY);
      const iterator = Set.prototype.values.call(this);
      return shallow ? iterator : reactiveIterator(iterator, false, wrap);
    },
    keys: function (this: Set<any>) {
      track(this, ITERATE_KEY);
      const iterator = Set.prototype.keys.call(this);
      return shallow ? iterator : reactiveIterator(iterator, false, wrap);
    },
    entries: function (this: Set<any>) {
      track(this, ITERATE_KEY);
      const iterator = Set.prototype.entries.call(this);
      return shallow ? iterator : reactiveIterator(iterator, true, wrap);
    },
    [Symbol.iterator]: function (this: Set<any>) {
      track(this, ITERATE_KEY);
      const iterator = Set.prototype[Symbol.iterator].call(this);
      return shallow ? iterator : reactiveIterator(iterator, false, wrap);
    },
    add: function (this: Set<any>) {
      warnReadonly('add');
      return this;
    },
    delete: function () {
      warnReadonly('delete');
      return false;
    },
    clear: function () {
      warnReadonly('clear');
      return undefined;
    }
  };
}

const readonlySetInstrumentations = createReadonlySetInstrumentations(false);
const shallowReadonlySetInstrumentations = createReadonlySetInstrumentations(true);

/**
 * 创建代理对象
 */
function createProxy<T extends object>(raw: T, isReadonly: boolean, shallow: boolean): T {
  const source = unwrapRaw(raw);

  if (source === null || source === undefined || !shouldInstrument(source)) {
    return source as T;
  }

  const cache = getProxyCache(isReadonly, shallow);
  const existingProxy = cache.get(source);
  if (existingProxy) {
    return existingProxy as T;
  }

  const proxy = new Proxy(source, {
    get(target, key, receiver) {
      if (Array.isArray(target)) {
        if (isReadonly && readonlyArrayInstrumentations.hasOwnProperty(key)) {
          return readonlyArrayInstrumentations[key as string].bind(target);
        }
        if (!isReadonly && arrayInstrumentations.hasOwnProperty(key)) {
          return arrayInstrumentations[key as string].bind(target);
        }
      }

      if (target instanceof Map) {
        if (isReadonly && key === 'set') {
          return () => {
            warnReadonly('set');
            return receiver;
          };
        }
        if (isReadonly && key === 'delete') {
          return () => {
            warnReadonly('delete');
            return false;
          };
        }
        if (isReadonly && key === 'clear') {
          return () => {
            warnReadonly('clear');
            return undefined;
          };
        }

        const mapIns = isReadonly
          ? (shallow ? shallowReadonlyMapInstrumentations : readonlyMapInstrumentations)
          : (shallow ? shallowMapInstrumentations : mapInstrumentations);

        if (mapIns.hasOwnProperty(key)) {
          return mapIns[key].bind(target);
        }
        if (key === 'size') {
          track(target, 'size');
          return Reflect.get(target, key, target);
        }
      }

      if (target instanceof Set) {
        if (isReadonly && key === 'add') {
          return () => {
            warnReadonly('add');
            return receiver;
          };
        }
        if (isReadonly && key === 'delete') {
          return () => {
            warnReadonly('delete');
            return false;
          };
        }
        if (isReadonly && key === 'clear') {
          return () => {
            warnReadonly('clear');
            return undefined;
          };
        }

        const setIns = isReadonly
          ? (shallow ? shallowReadonlySetInstrumentations : readonlySetInstrumentations)
          : setInstrumentations;

        if (setIns.hasOwnProperty(key as string)) {
          return setIns[key as string].bind(target);
        }
        if (key === 'size') {
          track(target, 'size');
          return Reflect.get(target, key, target);
        }
      }

      track(target, key);
      const result = Reflect.get(target, key, receiver);

      if (typeof result === 'object' && result !== null &&
        !(result instanceof Date) &&
        !(result instanceof RegExp) &&
        !(result instanceof Promise)) {
        return wrapValueByMode(result, isReadonly, shallow);
      }

      return result;
    },

    set(target, key, value, receiver) {
      if (isReadonly) {
        warnReadonly('set', key);
        return true;
      }

      if (Array.isArray(target) && key === 'length') {
        return arrayAccessors.length.call(target, value);
      }

      const hadKey = Reflect.has(target, key);
      const oldValue = (target as any)[key];
      const result = Reflect.set(target, key, value, receiver);

      if (result && oldValue !== value) {
        const operation: ReactionOperation = {
          target: toRaw(target),
          type: hadKey ? 'set' : 'add',
          property: key,
          value,
          oldValue,
        };

        trigger(target, key, operation);
        if (!hadKey) {
          trigger(target, ITERATE_KEY, operation);
        }
      }

      return result;
    },

    deleteProperty(target, key) {
      if (isReadonly) {
        warnReadonly('delete', key);
        return true;
      }

      const hadKey = Reflect.has(target, key);
      const oldValue = (target as any)[key];
      const result = Reflect.deleteProperty(target, key);

      if (result && hadKey) {
        const operation: ReactionOperation = {
          target: toRaw(target),
          type: 'delete',
          property: key,
          oldValue,
        };

        trigger(target, key, operation);
        trigger(target, ITERATE_KEY, operation);
      }

      return result;
    },

    ownKeys(target) {
      if (Array.isArray(target)) {
        track(target, 'length');
      } else {
        track(target, ITERATE_KEY);
      }
      return Reflect.ownKeys(target);
    },

    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    }
  }) as T;

  cache.set(source, proxy);
  proxyToRaw.set(proxy, source);

  if (isReadonly) {
    readonlyProxies.add(proxy);
  } else {
    reactiveProxies.add(proxy);
  }

  return proxy;
}

/** 创建深层响应式代理 */
export function reactive<T extends object>(raw: T): T {
  return createProxy(raw, false, false);
}

/** 创建浅层响应式代理（仅顶层响应） */
export function shallowReactive<T extends object>(raw: T): T {
  return createProxy(raw, false, true);
}

/** 创建深层只读代理 */
export function readonly<T extends object>(raw: T): Readonly<T> {
  return createProxy(raw, true, false) as Readonly<T>;
}

/** 创建浅层只读代理（仅顶层只读） */
export function shallowReadonly<T extends object>(raw: T): Readonly<T> {
  return createProxy(raw, true, true) as Readonly<T>;
}

/**
 * 判断一个值是否是响应式对象
 * @param proxy 要检查的值
 * @returns 如果是响应式对象则返回 true，否则返回 false
 */
export const isReactive = (proxy: object): boolean => {
  return reactiveProxies.has(proxy);
};

/** 判断一个值是否是只读代理 */
export const isReadonly = (proxy: object): boolean => {
  return readonlyProxies.has(proxy);
};

/** 判断一个值是否是响应式代理或只读代理 */
export const isProxy = (value: object): boolean => {
  return proxyToRaw.has(value);
};

/**
 * 获取 proxy 的原始对象
 * @param proxy 代理对象
 * @returns 原始对象
 */
export function toRaw<T extends object>(proxy: T): T {
  return (proxyToRaw.get(proxy) as T) || proxy;
}

/**
 * 立即运行一个函数，同时响应式地追踪其依赖，并在依赖更改时重新执行。
 * @param effect 需要响应式追踪的函数
 * @returns WatchHandle 对象
 */
export function watchEffect(
  effect: (operation?: ReactionOperation) => void,
  options: WatchEffectOptions = {}
): WatchHandle {
  const { flush = 'sync' } = options;
  let reactionWrap: ReactionFunction;
  const scheduler = flush === 'post'
    ? createPostScheduler((operation?: ReactionOperation) => reactionWrap(operation))
    : undefined;

  reactionWrap = createReactionWrap(effect, scheduler);

  // 立即执行一次
  reactionWrap();

  // 创建控制函数
  const stop = () => {
    if (reactionWrap.active) {
      cleanupReactionDependencies(reactionWrap);
      reactionWrap.active = false;
      reactionWrap.paused = false;
    }
  };

  const pause = () => {
    reactionWrap.paused = true;
  };

  const resume = () => {
    reactionWrap.paused = false;
    reactionWrap();
  };

  // 创建 WatchHandle 对象
  const handle = (() => stop()) as WatchHandle;
  handle.pause = pause;
  handle.resume = resume;
  handle.stop = stop;

  return handle;
}

/**
 * 监听特定值的变化（默认不立即执行 callback），并在变化时执行副作用函数。
 * @param source 单个 WatchSource 
 * @param callback 变化时执行的函数
 * @param options 配置选项
 * @returns WatchHandle 对象
 */
export function watch(
  source: WatchSource,
  callback: WatchCallback,
  options?: WatchOptions
): WatchHandle;

/**
 * 监听特定值的变化（默认不立即执行 callback），并在变化时执行副作用函数。
 * @param source 多个 WatchSource 组成的数组
 * @param callback 变化时执行的函数
 * @param options 配置选项
 * @returns WatchHandle 对象
 */
export function watch(
  source: WatchSource[],
  callback: WatchCallback,
  options?: WatchOptions
): WatchHandle;

/**
 * 监听特定值的变化（默认不立即执行 callback），并在变化时执行副作用函数。
 * @param source 单个或多个 WatchSource
 * @param callback 变化时执行的函数，接收变化信息参数
 * @param options 配置选项
 * @returns WatchHandle 对象
 */
export function watch(
  source: WatchSource | WatchSource[],
  callback: WatchCallback,
  options: WatchOptions = {}
): WatchHandle {
  const { immediate = false, flush = 'sync' } = options;
  let isFirstRun = true;

  // 精确判断：如果是数组且本身是代理对象，则当作单个源处理
  const isArray = Array.isArray(source);
  const isProxyArray = isArray && isProxy(source as object);

  // 如果是代理数组，当作单个源；如果是普通数组，当作多个源
  const isMultiSource = isArray && !isProxyArray;
  const sources = isMultiSource ? source : [source];

  // 检查所有源的类型
  for (const src of sources) {
    const isReactiveObject = typeof src === 'object' && src !== null && (isReactive(src) || isReadonly(src));
    const isGetter = typeof src === 'function';
    if (!isReactiveObject && !isGetter) {
      throw new Error('watch source must be a getter function or a reactive object');
    }
  }

  let reactionWrap: ReactionFunction;
  const scheduler = flush === 'post'
    ? createPostScheduler((operation?: ReactionOperation) => reactionWrap(operation))
    : undefined;

  reactionWrap = createReactionWrap((operation?: ReactionOperation) => {
    const originalShouldTrack = shouldTrack;
    shouldTrack = true;

    // 遍历所有源，建立依赖
    for (const src of sources) {
      if (typeof src === 'function') {
        // 执行 getter 函数
        (src as Function)();
      } else if (isReactive(src) || isReadonly(src)) {
        // 处理响应式对象
        const reactiveObj = src as any;
        if (Array.isArray(reactiveObj)) {
          // 数组：访问 length 和所有索引
          reactiveObj.length;
          for (let i = 0; i < reactiveObj.length; i++) {
            reactiveObj[i];
          }
        } else if (reactiveObj instanceof Map || reactiveObj instanceof Set) {
          if (reactiveObj instanceof Map) {
            // Map：访问 size、结构迭代和每个 key 的值，确保 set(existingKey) 也能触发。
            reactiveObj.size;
            for (const [key] of reactiveObj.entries()) {
              reactiveObj.get(key);
            }
          } else {
            // Set：访问 size
            reactiveObj.size;
          }
        } else {
          // 普通对象：访问所有可枚举属性
          for (const key in reactiveObj) {
            if (Object.prototype.hasOwnProperty.call(reactiveObj, key)) {
              reactiveObj[key];
            }
          }
        }
      }
    }

    shouldTrack = false;
    try {
      if (!isFirstRun || immediate) {
        callback(operation);
      }
    } finally {
      isFirstRun = false;
      shouldTrack = originalShouldTrack;
    }
  }, scheduler);

  // 建立依赖关系
  reactionWrap();

  const stop = () => {
    if (reactionWrap.active) {
      cleanupReactionDependencies(reactionWrap);
      reactionWrap.active = false;
      reactionWrap.paused = false;
    }
  };

  const pause = () => {
    reactionWrap.paused = true;
  };

  const resume = () => {
    reactionWrap.paused = false;
    reactionWrap();
  };

  const handle = (() => stop()) as WatchHandle;
  handle.pause = pause;
  handle.resume = resume;
  handle.stop = stop;

  return handle;
}

/**
 * 计算属性
 * @param getter 计算函数
 * @returns 响应式的计算值
 */
export function computed<T>(getter: () => T): { readonly value: T } {
  let value: T;
  let dirty = true;
  const computedTarget = {};

  const reactionWrap = createReactionWrap(() => {
    value = getter();
    dirty = false;
  }, () => {
    if (!dirty) {
      dirty = true;
      trigger(computedTarget, 'value', {
        target: computedTarget,
        type: 'set',
        property: 'value',
      });
    }
  });

  return {
    get value() {
      track(computedTarget, 'value');
      if (dirty) {
        reactionWrap();
      }
      return value;
    }
  };
}
