"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
// scene.ts
const path_1 = require("path");
// 添加编辑器路径到 module.paths
module.paths.push((0, path_1.join)(Editor.App.path, "node_modules"));
let assetUrlMap = null;
/**
 * 构建候选 URL 列表
 */
function buildCandidateUrls(imagePath) {
    const normalized = String(imagePath || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
    if (!normalized)
        return [];
    return [
        `db://assets/resources/${normalized}/spriteFrame`,
        `db://assets/resources/${normalized}.png`,
        `db://assets/resources/${normalized}.png/spriteFrame`,
        `db://assets/resources/${normalized}.jpg`,
        `db://assets/resources/${normalized}.jpg/spriteFrame`,
        `db://assets/resources/${normalized}.jpeg`,
        `db://assets/resources/${normalized}.jpeg/spriteFrame`,
        `db://assets/resources/${normalized}.webp`,
        `db://assets/resources/${normalized}.webp/spriteFrame`
    ];
}
/**
 * 判断是否是 SpriteFrame 资源信息
 */
function isSpriteFrameInfo(info) {
    if (!info)
        return false;
    const importer = String(info.importer || "").toLowerCase();
    const type = String(info.type || "").toLowerCase();
    const name = String(info.name || "").toLowerCase();
    const url = String(info.url || "").toLowerCase();
    return importer === "sprite-frame"
        || type.includes("spriteframe")
        || type.includes("sprite-frame")
        || name.endsWith("/spriteframe")
        || url.endsWith("/spriteframe");
}
/**
 * 查找 SpriteFrame 子资源
 */
function findSpriteFrameSubAssetInfo(info) {
    const subAssets = info.subAssets;
    if (!subAssets || typeof subAssets !== "object")
        return null;
    const entries = Array.isArray(subAssets) ? subAssets : Object.values(subAssets);
    for (const subInfo of entries) {
        if ((subInfo === null || subInfo === void 0 ? void 0 : subInfo.uuid) && isSpriteFrameInfo(subInfo)) {
            return subInfo;
        }
    }
    return null;
}
/**
 * 获取资源 URL 映射表
 */
async function ensureAssetUrlMap(forceRefresh = false) {
    if (assetUrlMap && !forceRefresh)
        return assetUrlMap;
    const allAssets = await Editor.Message.request("asset-db", "query-assets");
    const map = new Map();
    for (const info of allAssets || []) {
        if (!info || !info.url || !info.uuid || info.isDirectory)
            continue;
        map.set(info.url, info);
    }
    assetUrlMap = map;
    return map;
}
/**
 * 查询图片资源信息
 */
async function queryAssetInfo(imagePath) {
    const candidates = buildCandidateUrls(imagePath);
    if (candidates.length === 0) {
        return null;
    }
    // 第一次查询，使用缓存
    let map = await ensureAssetUrlMap(false);
    for (const url of candidates) {
        const info = map.get(url);
        if (info === null || info === void 0 ? void 0 : info.uuid) {
            if (!isSpriteFrameInfo(info)) {
                const subInfo = findSpriteFrameSubAssetInfo(info);
                if (subInfo === null || subInfo === void 0 ? void 0 : subInfo.uuid) {
                    return subInfo;
                }
            }
            return info;
        }
    }
    // 第二次查询，强制刷新
    map = await ensureAssetUrlMap(true);
    for (const url of candidates) {
        const info = map.get(url);
        if (info === null || info === void 0 ? void 0 : info.uuid) {
            if (!isSpriteFrameInfo(info)) {
                const subInfo = findSpriteFrameSubAssetInfo(info);
                if (subInfo === null || subInfo === void 0 ? void 0 : subInfo.uuid) {
                    return subInfo;
                }
            }
            return info;
        }
    }
    return null;
}
/**
 * 导出的方法（供其他模块调用）
 */
exports.methods = {
    async resolveSpriteByImagePath(imagePath) {
        var _a;
        const info = await queryAssetInfo(imagePath);
        return (_a = info === null || info === void 0 ? void 0 : info.uuid) !== null && _a !== void 0 ? _a : "";
    }
};
/**
 * 扩展加载时执行
 */
function load() {
    globalThis.__BTK_I18N_EDITOR_SPRITE_UUID_RESOLVER = async (imagePath) => {
        var _a;
        const info = await queryAssetInfo(imagePath);
        return (_a = info === null || info === void 0 ? void 0 : info.uuid) !== null && _a !== void 0 ? _a : null;
    };
}
/**
 * 扩展卸载时执行
 */
function unload() {
    assetUrlMap = null;
    delete globalThis.__BTK_I18N_EDITOR_SPRITE_UUID_RESOLVER;
    delete globalThis.__BTK_I18N_EDITOR_SPRITE_RESOLVER;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBaUtBLG9CQUtDO0FBS0Qsd0JBSUM7QUEvS0QsV0FBVztBQUNYLCtCQUE0QjtBQXVCNUIsd0JBQXdCO0FBQ3hCLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUEsV0FBSSxFQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFFekQsSUFBSSxXQUFXLEdBQWtDLElBQUksQ0FBQztBQUV0RDs7R0FFRztBQUNILFNBQVMsa0JBQWtCLENBQUMsU0FBaUI7SUFDM0MsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUM7U0FDdkMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUM7U0FDbkIsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUV2QixJQUFJLENBQUMsVUFBVTtRQUFFLE9BQU8sRUFBRSxDQUFDO0lBRTNCLE9BQU87UUFDTCx5QkFBeUIsVUFBVSxjQUFjO1FBQ2pELHlCQUF5QixVQUFVLE1BQU07UUFDekMseUJBQXlCLFVBQVUsa0JBQWtCO1FBQ3JELHlCQUF5QixVQUFVLE1BQU07UUFDekMseUJBQXlCLFVBQVUsa0JBQWtCO1FBQ3JELHlCQUF5QixVQUFVLE9BQU87UUFDMUMseUJBQXlCLFVBQVUsbUJBQW1CO1FBQ3RELHlCQUF5QixVQUFVLE9BQU87UUFDMUMseUJBQXlCLFVBQVUsbUJBQW1CO0tBQ3ZELENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGlCQUFpQixDQUFDLElBQWtDO0lBQzNELElBQUksQ0FBQyxJQUFJO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFeEIsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMs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O0lBQzFCLENBQUM7Q0FDRixDQUFDO0FBRUY7O0dBRUc7QUFDSCxTQUFnQixJQUFJO0lBQ2xCLFVBQVUsQ0FBQyxzQ0FBc0MsR0FBRyxLQUFLLEVBQUUsU0FBaUIsRUFBRSxFQUFFOztRQUM5RSxNQUFNLElBQUksR0FBRyxNQUFNLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QyxPQUFPLE1BQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLElBQUksbUNBQUksSUFBSSxDQUFDO0lBQzVCLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLE1BQU07SUFDcEIsV0FBVyxHQUFHLElBQUksQ0FBQztJQUNuQixPQUFPLFVBQVUsQ0FBQyxzQ0FBc0MsQ0FBQztJQUN6RCxPQUFPLFVBQVUsQ0FBQyxpQ0FBaUMsQ0FBQztBQUN0RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gc2NlbmUudHNcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5cclxuLy8g57G75Z6L5a6a5LmJXHJcbmludGVyZmFjZSBBc3NldEluZm8ge1xyXG4gIHVybDogc3RyaW5nO1xyXG4gIHV1aWQ6IHN0cmluZztcclxuICBpc0RpcmVjdG9yeT86IGJvb2xlYW47XHJcbiAgaW1wb3J0ZXI/OiBzdHJpbmc7XHJcbiAgdHlwZT86IHN0cmluZztcclxuICBuYW1lPzogc3RyaW5nO1xyXG4gIHN1YkFzc2V0cz86IFJlY29yZDxzdHJpbmcsIEFzc2V0SW5mbz4gfCBBc3NldEluZm9bXTtcclxufVxyXG5cclxuaW50ZXJmYWNlIFNwcml0ZVVVSURSZXNvbHZlciB7XHJcbiAgKGltYWdlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPjtcclxufVxyXG5cclxuLy8g5omp5bGV5YWo5bGA57G75Z6LXHJcbmRlY2xhcmUgZ2xvYmFsIHtcclxuICB2YXIgX19CVEtfSTE4Tl9FRElUT1JfU1BSSVRFX1VVSURfUkVTT0xWRVI6IFNwcml0ZVVVSURSZXNvbHZlciB8IHVuZGVmaW5lZDtcclxuICB2YXIgX19CVEtfSTE4Tl9FRElUT1JfU1BSSVRFX1JFU09MVkVSOiBhbnkgfCB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbi8vIOa3u+WKoOe8lui+keWZqOi3r+W+hOWIsCBtb2R1bGUucGF0aHNcclxubW9kdWxlLnBhdGhzLnB1c2goam9pbihFZGl0b3IuQXBwLnBhdGgsIFwibm9kZV9tb2R1bGVzXCIpKTtcclxuXHJcbmxldCBhc3NldFVybE1hcDogTWFwPHN0cmluZywgQXNzZXRJbmZvPiB8IG51bGwgPSBudWxsO1xyXG5cclxuLyoqXHJcbiAqIOaehOW7uuWAmemAiSBVUkwg5YiX6KGoXHJcbiAqL1xyXG5mdW5jdGlvbiBidWlsZENhbmRpZGF0ZVVybHMoaW1hZ2VQYXRoOiBzdHJpbmcpOiBzdHJpbmdbXSB7XHJcbiAgY29uc3Qgbm9ybWFsaXplZCA9IFN0cmluZyhpbWFnZVBhdGggfHwgXCJcIilcclxuICAgIC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxyXG4gICAgLnJlcGxhY2UoL15cXC8rLywgXCJcIik7XHJcblxyXG4gIGlmICghbm9ybWFsaXplZCkgcmV0dXJuIFtdO1xyXG5cclxuICByZXR1cm4gW1xyXG4gICAgYGRiOi8vYXNzZXRzL3Jlc291cmNlcy8ke25vcm1hbGl6ZWR9L3Nwcml0ZUZyYW1lYCxcclxuICAgIGBkYjovL2Fzc2V0cy9yZXNvdXJjZXMvJHtub3JtYWxpemVkfS5wbmdgLFxyXG4gICAgYGRiOi8vYXNzZXRzL3Jlc291cmNlcy8ke25vcm1hbGl6ZWR9LnBuZy9zcHJpdGVGcmFtZWAsXHJcbiAgICBgZGI6Ly9hc3NldHMvcmVzb3VyY2VzLyR7bm9ybWFsaXplZH0uanBnYCxcclxuICAgIGBkYjovL2Fzc2V0cy9yZXNvdXJjZXMvJHtub3JtYWxpemVkfS5qcGcvc3ByaXRlRnJhbWVgLFxyXG4gICAgYGRiOi8vYXNzZXRzL3Jlc291cmNlcy8ke25vcm1hbGl6ZWR9LmpwZWdgLFxyXG4gICAgYGRiOi8vYXNzZXRzL3Jlc291cmNlcy8ke25vcm1hbGl6ZWR9LmpwZWcvc3ByaXRlRnJhbWVgLFxyXG4gICAgYGRiOi8vYXNzZXRzL3Jlc291cmNlcy8ke25vcm1hbGl6ZWR9LndlYnBgLFxyXG4gICAgYGRiOi8vYXNzZXRzL3Jlc291cmNlcy8ke25vcm1hbGl6ZWR9LndlYnAvc3ByaXRlRnJhbWVgXHJcbiAgXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOWIpOaWreaYr+WQpuaYryBTcHJpdGVGcmFtZSDotYTmupDkv6Hmga9cclxuICovXHJcbmZ1bmN0aW9uIGlzU3ByaXRlRnJhbWVJbmZvKGluZm86IEFzc2V0SW5mbyB8IG51bGwgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcclxuICBpZiAoIWluZm8pIHJldHVybiBmYWxzZTtcclxuXHJcbiAgY29uc3QgaW1wb3J0ZXIgPSBTdHJpbmcoaW5mby5pbXBvcnRlciB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xyXG4gIGNvbnN0IHR5cGUgPSBTdHJpbmcoaW5mby50eXBlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XHJcbiAgY29uc3QgbmFtZSA9IFN0cmluZyhpbmZvLm5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcclxuICBjb25zdCB1cmwgPSBTdHJpbmcoaW5mby51cmwgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgcmV0dXJuIGltcG9ydGVyID09PSBcInNwcml0ZS1mcmFtZVwiXHJcbiAgICB8fCB0eXBlLmluY2x1ZGVzKFwic3ByaXRlZnJhbWVcIilcclxuICAgIHx8IHR5cGUuaW5jbHVkZXMoXCJzcHJpdGUtZnJhbWVcIilcclxuICAgIHx8IG5hbWUuZW5kc1dpdGgoXCIvc3ByaXRlZnJhbWVcIilcclxuICAgIHx8IHVybC5lbmRzV2l0aChcIi9zcHJpdGVmcmFtZVwiKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOafpeaJviBTcHJpdGVGcmFtZSDlrZDotYTmupBcclxuICovXHJcbmZ1bmN0aW9uIGZpbmRTcHJpdGVGcmFtZVN1YkFzc2V0SW5mbyhpbmZvOiBBc3NldEluZm8pOiBBc3NldEluZm8gfCBudWxsIHtcclxuICBjb25zdCBzdWJBc3NldHMgPSBpbmZvLnN1YkFzc2V0cztcclxuICBpZiAoIXN1YkFzc2V0cyB8fCB0eXBlb2Ygc3ViQXNzZXRzICE9PSBcIm9iamVjdFwiKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmlzQXJyYXkoc3ViQXNzZXRzKSA/IHN1YkFzc2V0cyA6IE9iamVjdC52YWx1ZXMoc3ViQXNzZXRzKTtcclxuXHJcbiAgZm9yIChjb25zdCBzdWJJbmZvIG9mIGVudHJpZXMpIHtcclxuICAgIGlmIChzdWJJbmZvPy51dWlkICYmIGlzU3ByaXRlRnJhbWVJbmZvKHN1YkluZm8pKSB7XHJcbiAgICAgIHJldHVybiBzdWJJbmZvO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDojrflj5botYTmupAgVVJMIOaYoOWwhOihqFxyXG4gKi9cclxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlQXNzZXRVcmxNYXAoZm9yY2VSZWZyZXNoOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPE1hcDxzdHJpbmcsIEFzc2V0SW5mbz4+IHtcclxuICBpZiAoYXNzZXRVcmxNYXAgJiYgIWZvcmNlUmVmcmVzaCkgcmV0dXJuIGFzc2V0VXJsTWFwO1xyXG5cclxuICBjb25zdCBhbGxBc3NldHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KFwiYXNzZXQtZGJcIiwgXCJxdWVyeS1hc3NldHNcIikgYXMgQXNzZXRJbmZvW107XHJcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEFzc2V0SW5mbz4oKTtcclxuXHJcbiAgZm9yIChjb25zdCBpbmZvIG9mIGFsbEFzc2V0cyB8fCBbXSkge1xyXG4gICAgaWYgKCFpbmZvIHx8ICFpbmZvLnVybCB8fCAhaW5mby51dWlkIHx8IGluZm8uaXNEaXJlY3RvcnkpIGNvbnRpbnVlO1xyXG4gICAgbWFwLnNldChpbmZvLnVybCwgaW5mbyk7XHJcbiAgfVxyXG5cclxuICBhc3NldFVybE1hcCA9IG1hcDtcclxuICByZXR1cm4gbWFwO1xyXG59XHJcblxyXG4vKipcclxuICog5p+l6K+i5Zu+54mH6LWE5rqQ5L+h5oGvXHJcbiAqL1xyXG5hc3luYyBmdW5jdGlvbiBxdWVyeUFzc2V0SW5mbyhpbWFnZVBhdGg6IHN0cmluZyk6IFByb21pc2U8QXNzZXRJbmZvIHwgbnVsbD4ge1xyXG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBidWlsZENhbmRpZGF0ZVVybHMoaW1hZ2VQYXRoKTtcclxuICBpZiAoY2FuZGlkYXRlcy5sZW5ndGggPT09IDApIHtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLy8g56ys5LiA5qyh5p+l6K+i77yM5L2/55So57yT5a2YXHJcbiAgbGV0IG1hcCA9IGF3YWl0IGVuc3VyZUFzc2V0VXJsTWFwKGZhbHNlKTtcclxuICBmb3IgKGNvbnN0IHVybCBvZiBjYW5kaWRhdGVzKSB7XHJcbiAgICBjb25zdCBpbmZvID0gbWFwLmdldCh1cmwpO1xyXG4gICAgaWYgKGluZm8/LnV1aWQpIHtcclxuICAgICAgaWYgKCFpc1Nwcml0ZUZyYW1lSW5mbyhpbmZvKSkge1xyXG4gICAgICAgIGNvbnN0IHN1YkluZm8gPSBmaW5kU3ByaXRlRnJhbWVTdWJBc3NldEluZm8oaW5mbyk7XHJcbiAgICAgICAgaWYgKHN1YkluZm8/LnV1aWQpIHtcclxuICAgICAgICAgIHJldHVybiBzdWJJbmZvO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gaW5mbztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIOesrOS6jOasoeafpeivou+8jOW8uuWItuWIt+aWsFxyXG4gIG1hcCA9IGF3YWl0IGVuc3VyZUFzc2V0VXJsTWFwKHRydWUpO1xyXG4gIGZvciAoY29uc3QgdXJsIG9mIGNhbmRpZGF0ZXMpIHtcclxuICAgIGNvbnN0IGluZm8gPSBtYXAuZ2V0KHVybCk7XHJcbiAgICBpZiAoaW5mbz8udXVpZCkge1xyXG4gICAgICBpZiAoIWlzU3ByaXRlRnJhbWVJbmZvKGluZm8pKSB7XHJcbiAgICAgICAgY29uc3Qgc3ViSW5mbyA9IGZpbmRTcHJpdGVGcmFtZVN1YkFzc2V0SW5mbyhpbmZvKTtcclxuICAgICAgICBpZiAoc3ViSW5mbz8udXVpZCkge1xyXG4gICAgICAgICAgcmV0dXJuIHN1YkluZm87XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBpbmZvO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDlr7zlh7rnmoTmlrnms5XvvIjkvpvlhbbku5bmqKHlnZfosIPnlKjvvIlcclxuICovXHJcbmV4cG9ydCBjb25zdCBtZXRob2RzID0ge1xyXG4gIGFzeW5jIHJlc29sdmVTcHJpdGVCeUltYWdlUGF0aChpbWFnZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICBjb25zdCBpbmZvID0gYXdhaXQgcXVlcnlBc3NldEluZm8oaW1hZ2VQYXRoKTtcclxuICAgIHJldHVybiBpbmZvPy51dWlkID8/IFwiXCI7XHJcbiAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIOaJqeWxleWKoOi9veaXtuaJp+ihjFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKTogdm9pZCB7XHJcbiAgZ2xvYmFsVGhpcy5fX0JUS19JMThOX0VESVRPUl9TUFJJVEVfVVVJRF9SRVNPTFZFUiA9IGFzeW5jIChpbWFnZVBhdGg6IHN0cmluZykgPT4ge1xyXG4gICAgY29uc3QgaW5mbyA9IGF3YWl0IHF1ZXJ5QXNzZXRJbmZvKGltYWdlUGF0aCk7XHJcbiAgICByZXR1cm4gaW5mbz8udXVpZCA/PyBudWxsO1xyXG4gIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDmianlsZXljbjovb3ml7bmiafooYxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bmxvYWQoKTogdm9pZCB7XHJcbiAgYXNzZXRVcmxNYXAgPSBudWxsO1xyXG4gIGRlbGV0ZSBnbG9iYWxUaGlzLl9fQlRLX0kxOE5fRURJVE9SX1NQUklURV9VVUlEX1JFU09MVkVSO1xyXG4gIGRlbGV0ZSBnbG9iYWxUaGlzLl9fQlRLX0kxOE5fRURJVE9SX1NQUklURV9SRVNPTFZFUjtcclxufSJdfQ==