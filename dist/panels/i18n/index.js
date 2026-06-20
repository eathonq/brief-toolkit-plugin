"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const package_json_1 = __importDefault(require("../../../package.json"));
const PACKAGE_NAME = package_json_1.default.name;
const PROFILE_KEY = 'i18nPanelState';
const RESOURCES_DB_ROOT = 'db://assets/resources';
const SCHEMA_FILE_NAME = '.schema.json';
const DEFAULT_LOCALE_VERSION = '1.0.0';
const LOCALE_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: '.schema.json',
    title: 'i18n locale file',
    type: 'object',
    required: ['meta'],
    properties: {
        meta: {
            type: 'object',
            title: '多语言文本Meta信息',
            required: ['code'],
            properties: {
                code: {
                    type: 'string',
                    title: '多语言编码（也是多语言文件名称，图片目录名称）',
                },
                name: {
                    type: 'string',
                    title: '多语言名称',
                },
                version: {
                    type: 'string',
                    title: '多语言版本',
                },
            },
            additionalProperties: true,
        },
    },
    additionalProperties: true,
};
function isJsonObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function syncLocaleNode(baseNode, targetNode, isRoot = false) {
    const base = isJsonObject(baseNode) ? baseNode : {};
    const target = isJsonObject(targetNode) ? targetNode : {};
    const result = {};
    Object.keys(base).forEach((key) => {
        if (isRoot && key === 'meta') {
            if (Object.prototype.hasOwnProperty.call(target, 'meta')) {
                result.meta = cloneJson(target.meta);
            }
            else {
                result.meta = cloneJson(base.meta);
            }
            return;
        }
        const baseValue = base[key];
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
            result[key] = cloneJson(baseValue);
            return;
        }
        const targetValue = target[key];
        if (isJsonObject(baseValue)) {
            const normalizedTargetValue = isJsonObject(targetValue) ? targetValue : {};
            result[key] = syncLocaleNode(baseValue, normalizedTargetValue);
            return;
        }
        result[key] = cloneJson(targetValue);
    });
    if (isRoot && !Object.prototype.hasOwnProperty.call(result, 'meta') && Object.prototype.hasOwnProperty.call(target, 'meta')) {
        result.meta = cloneJson(target.meta);
    }
    return result;
}
function buildSyncedLocaleContent(baseContent, targetContent) {
    const baseNode = isJsonObject(baseContent) ? baseContent : {};
    const targetNode = isJsonObject(targetContent) ? targetContent : {};
    return syncLocaleNode(baseNode, targetNode, true);
}
function normalizeDir(value) {
    return value.trim().replace(/^[\\/]+|[\\/]+$/g, '');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function normalizeLocaleCode(value) {
    return normalizeDir(value).replace(/\.json$/i, '');
}
function createDefaultLocaleContent(code) {
    return {
        $schema: SCHEMA_FILE_NAME,
        meta: {
            code,
            version: DEFAULT_LOCALE_VERSION,
        },
    };
}
function getResourcesFsRoot() {
    return (0, path_1.join)(Editor.Project.path, 'assets', 'resources');
}
function toResourceDbPath(relativeDir) {
    const normalized = normalizeDir(relativeDir);
    return normalized ? `${RESOURCES_DB_ROOT}/${normalized}` : RESOURCES_DB_ROOT;
}
function toResourceFsPath(relativeDir) {
    const normalized = normalizeDir(relativeDir);
    return normalized ? (0, path_1.join)(getResourcesFsRoot(), normalized) : getResourcesFsRoot();
}
function toLocaleDbPath(resourceDir, fileName) {
    return `${toResourceDbPath(resourceDir)}/${fileName}`;
}
/**
 * @zh 如果希望兼容 3.3 之前的版本可以使用下方的代码
 * @en You can add the code below if you want compatibility with versions prior to 3.3
 */
// Editor.Panel.define = Editor.Panel.define || function(options: any) { return options }
module.exports = Editor.Panel.define({
    listeners: {
        show() {
            console.log('show');
        },
        hide() {
            console.log('hide');
        },
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/i18n/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/i18n/index.css'), 'utf-8'),
    $: {
        app: '#app',
        resourceDirInput: '#resourceDirInput',
        confirmResourceDirBtn: '#confirmResourceDirBtn',
        dirTableBody: '#dirTableBody',
        newDirInput: '#newDirInput',
        addDirBtn: '#addDirBtn',
    },
    methods: {
        getDefaultState() {
            return {
                resourceDir: '',
                templateLocale: null,
            };
        },
        getState() {
            return this._state || this.getDefaultState();
        },
        getLocaleEntries() {
            return this._localeEntries || [];
        },
        normalizeTemplateLocale(templateLocale) {
            if (!templateLocale || typeof templateLocale !== 'object') {
                return null;
            }
            const fileName = String(templateLocale.fileName || '').trim();
            const content = templateLocale.content;
            if (!fileName || !content || typeof content !== 'object' || Array.isArray(content)) {
                return null;
            }
            return {
                fileName,
                content: cloneJson(content),
            };
        },
        normalizeState(state) {
            const defaultState = this.getDefaultState();
            const resourceDir = normalizeDir((state === null || state === void 0 ? void 0 : state.resourceDir) || defaultState.resourceDir);
            return {
                resourceDir,
                templateLocale: this.normalizeTemplateLocale(state === null || state === void 0 ? void 0 : state.templateLocale),
            };
        },
        async loadState() {
            try {
                const state = await Editor.Profile.getProject(PACKAGE_NAME, PROFILE_KEY);
                this._state = this.normalizeState(state);
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] Failed to load profile state:', error);
                this._state = this.getDefaultState();
            }
        },
        saveState(state) {
            const normalizedState = this.normalizeState(state);
            this._state = normalizedState;
            void Editor.Profile.setProject(PACKAGE_NAME, PROFILE_KEY, normalizedState, 'project').catch((error) => {
                console.warn('[brief-toolkit-plugin.i18n] Failed to save profile state:', error);
            });
        },
        getResourceDir() {
            const input = this.$.resourceDirInput;
            return normalizeDir((input === null || input === void 0 ? void 0 : input.value) || '');
        },
        async existsInResourcesDb(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return false;
            }
            try {
                const info = await Editor.Message.request('asset-db', 'query-asset-info', toResourceDbPath(normalized));
                return Boolean(info);
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] asset-db query failed, fallback to fs exists:', error);
                return (0, fs_extra_1.pathExists)(toResourceFsPath(normalized));
            }
        },
        async refreshResourcesAssetDb() {
            try {
                await Editor.Message.request('asset-db', 'refresh-asset', RESOURCES_DB_ROOT);
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] asset-db refresh failed:', error);
            }
        },
        async ensureResourceDirCreated(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return;
            }
            const resourcesFsRoot = getResourcesFsRoot();
            const resourcesExists = await (0, fs_extra_1.pathExists)(resourcesFsRoot);
            if (!resourcesExists) {
                await (0, fs_extra_1.ensureDir)(resourcesFsRoot);
            }
            await (0, fs_extra_1.ensureDir)(toResourceFsPath(normalized));
        },
        async ensureSchemaFile(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return;
            }
            const dirPath = toResourceFsPath(normalized);
            await (0, fs_extra_1.ensureDir)(dirPath);
            const schemaPath = (0, path_1.join)(dirPath, SCHEMA_FILE_NAME);
            const schemaExists = await (0, fs_extra_1.pathExists)(schemaPath);
            if (schemaExists) {
                return;
            }
            await (0, fs_extra_1.writeJson)(schemaPath, LOCALE_SCHEMA, { spaces: 2 });
            const created = await (0, fs_extra_1.pathExists)(schemaPath);
            if (!created) {
                throw new Error(`[brief-toolkit-plugin.i18n] 创建 schema 文件失败: ${schemaPath}`);
            }
            console.log(`[brief-toolkit-plugin.i18n] 已创建 schema 文件: ${schemaPath}`);
        },
        async transferResourceDir(oldDir, newDir) {
            const oldNormalized = normalizeDir(oldDir);
            const newNormalized = normalizeDir(newDir);
            if (!oldNormalized || !newNormalized || oldNormalized === newNormalized) {
                return;
            }
            const oldPath = toResourceFsPath(oldNormalized);
            const newPath = toResourceFsPath(newNormalized);
            const oldExists = await (0, fs_extra_1.pathExists)(oldPath);
            if (!oldExists) {
                throw new Error(`原目录不存在: ${oldPath}`);
            }
            const newExists = await (0, fs_extra_1.pathExists)(newPath);
            if (newExists) {
                throw new Error(`目标目录已存在: ${newPath}`);
            }
            await (0, fs_extra_1.move)(oldPath, newPath);
        },
        async listLocaleEntries(relativeDir) {
            const normalized = normalizeDir(relativeDir);
            if (!normalized) {
                return [];
            }
            const dirPath = toResourceFsPath(normalized);
            const exists = await (0, fs_extra_1.pathExists)(dirPath);
            if (!exists) {
                return [];
            }
            const fileNames = (await (0, fs_extra_1.readdir)(dirPath))
                .filter((fileName) => fileName.endsWith('.json') && fileName !== SCHEMA_FILE_NAME)
                .sort((left, right) => left.localeCompare(right, 'zh-CN'));
            return fileNames.map((fileName) => ({
                fileName,
                code: fileName.replace(/\.json$/i, ''),
                fullPath: (0, path_1.join)(dirPath, fileName),
                dbPath: toLocaleDbPath(normalized, fileName),
            }));
        },
        async readLocaleJson(filePath) {
            const content = await (0, fs_extra_1.readJson)(filePath);
            if (!content || typeof content !== 'object' || Array.isArray(content)) {
                return {};
            }
            return content;
        },
        async syncTemplateLocale(entries) {
            var _a;
            const state = this.getState();
            const templateFileName = ((_a = state.templateLocale) === null || _a === void 0 ? void 0 : _a.fileName) || '';
            const existingTemplate = templateFileName ? entries.find((entry) => entry.fileName === templateFileName) : undefined;
            if (!entries.length) {
                if (state.templateLocale) {
                    state.templateLocale = null;
                    this.saveState(state);
                }
                return;
            }
            if (existingTemplate) {
                return;
            }
            const firstEntry = entries[0];
            const firstContent = await this.readLocaleJson(firstEntry.fullPath);
            state.templateLocale = {
                fileName: firstEntry.fileName,
                content: cloneJson(firstContent),
            };
            this.saveState(state);
        },
        async refreshLocaleEntries() {
            const resourceDir = this.getState().resourceDir;
            if (resourceDir) {
                await this.ensureSchemaFile(resourceDir);
            }
            const entries = await this.listLocaleEntries(resourceDir);
            this._localeEntries = entries;
            await this.syncTemplateLocale(entries);
        },
        async getTemplateContent(entries) {
            var _a;
            const state = this.getState();
            const templateFileName = ((_a = state.templateLocale) === null || _a === void 0 ? void 0 : _a.fileName) || '';
            let templateEntry;
            if (templateFileName) {
                templateEntry = entries.find((entry) => entry.fileName === templateFileName);
            }
            if (!templateEntry && entries.length) {
                templateEntry = entries[0];
            }
            if (!templateEntry) {
                return createDefaultLocaleContent('');
            }
            // Always read from the template locale file to avoid using stale cached content.
            const templateContent = cloneJson(await this.readLocaleJson(templateEntry.fullPath));
            state.templateLocale = {
                fileName: templateEntry.fileName,
                content: cloneJson(templateContent),
            };
            this.saveState(state);
            return templateContent;
        },
        async updateConfirmButtonMode() {
            const button = this.$.confirmResourceDirBtn;
            if (!button) {
                return;
            }
            const state = this.getState();
            const savedDir = normalizeDir(state.resourceDir);
            const savedDirExists = savedDir ? await this.existsInResourcesDb(savedDir) : false;
            const mode = savedDirExists ? 'transfer' : 'add';
            this._confirmMode = mode;
            button.textContent = mode === 'transfer' ? '转移' : '添加';
        },
        renderDirectoryTable(entries) {
            var _a;
            const tableBody = this.$.dirTableBody;
            if (!tableBody) {
                return;
            }
            if (!entries.length) {
                tableBody.innerHTML = '<tr><td colspan="6" class="empty-tip">暂无多语言文件，请在下方新增。</td></tr>';
                return;
            }
            const templateFileName = ((_a = this.getState().templateLocale) === null || _a === void 0 ? void 0 : _a.fileName) || '';
            const canSync = entries.length > 1;
            tableBody.innerHTML = entries
                .map((entry, index) => {
                const isTemplate = entry.fileName === templateFileName;
                return (`<tr>
                            <td>${escapeHtml(entry.code)}</td>
                            <td><span class="template-flag">${isTemplate ? '是' : '否'}</span></td>
                            <td><button class="table-action-btn" type="button" data-action="set-template" data-index="${index}" ${isTemplate ? 'disabled' : ''}>${isTemplate ? '当前模板' : '设为模板'}</button></td>
                            <td><button class="table-action-btn" type="button" data-action="sync" data-index="${index}" ${canSync ? '' : 'disabled'}>同步</button></td>
                            <td><button class="table-action-btn" type="button" data-action="open" data-index="${index}">打开</button></td>
                            <td><button class="table-action-btn table-action-btn-danger" type="button" data-action="delete" data-index="${index}">删除</button></td>
                        </tr>`);
            })
                .join('');
        },
        render() {
            const state = this.getState();
            const resourceDirInput = this.$.resourceDirInput;
            const newDirInput = this.$.newDirInput;
            if (resourceDirInput) {
                resourceDirInput.value = state.resourceDir;
            }
            if (newDirInput) {
                newDirInput.value = '';
            }
            this.renderDirectoryTable(this.getLocaleEntries());
            void this.updateConfirmButtonMode();
        },
        async handleConfirmResourceDir() {
            const state = this.getState();
            const resourceDir = this.getResourceDir();
            if (!resourceDir) {
                console.warn('[brief-toolkit-plugin.i18n] 请先输入多语言目录。');
                return;
            }
            const mode = this._confirmMode || 'add';
            try {
                if (mode === 'transfer') {
                    await this.transferResourceDir(state.resourceDir, resourceDir);
                    console.log(`[brief-toolkit-plugin.i18n] 已将目录从 ${state.resourceDir} 转移为 ${resourceDir}`);
                }
                else {
                    await this.ensureResourceDirCreated(resourceDir);
                    console.log(`[brief-toolkit-plugin.i18n] 已添加目录: ${toResourceDbPath(resourceDir)}`);
                }
                await this.ensureSchemaFile(resourceDir);
                const schemaPath = (0, path_1.join)(toResourceFsPath(resourceDir), SCHEMA_FILE_NAME);
                const schemaExists = await (0, fs_extra_1.pathExists)(schemaPath);
                if (!schemaExists) {
                    throw new Error(`[brief-toolkit-plugin.i18n] schema 文件缺失: ${schemaPath}`);
                }
                console.log(`[brief-toolkit-plugin.i18n] schema 校验通过: ${schemaPath}`);
                state.resourceDir = resourceDir;
                this.saveState(state);
                await this.refreshResourcesAssetDb();
                await this.refreshLocaleEntries();
                this.render();
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] 设置目录失败:', error);
            }
        },
        async handleAddDirectory() {
            const newDirInput = this.$.newDirInput;
            if (!newDirInput) {
                return;
            }
            const resourceDir = this.getState().resourceDir || this.getResourceDir();
            if (!resourceDir) {
                console.warn('[brief-toolkit-plugin.i18n] 请先配置多语言资源目录。');
                return;
            }
            const localeCode = normalizeLocaleCode(newDirInput.value || '');
            if (!localeCode) {
                return;
            }
            try {
                await this.ensureResourceDirCreated(resourceDir);
                await this.ensureSchemaFile(resourceDir);
                const localeFileName = `${localeCode}.json`;
                const localeFilePath = (0, path_1.join)(toResourceFsPath(resourceDir), localeFileName);
                const exists = await (0, fs_extra_1.pathExists)(localeFilePath);
                if (exists) {
                    newDirInput.value = '';
                    console.warn(`[brief-toolkit-plugin.i18n] 多语言文件已存在: ${localeFileName}`);
                    return;
                }
                const entries = await this.listLocaleEntries(resourceDir);
                const localeContent = !entries.length
                    ? createDefaultLocaleContent(localeCode)
                    : await this.getTemplateContent(entries);
                localeContent.$schema = SCHEMA_FILE_NAME;
                if (!localeContent.meta || typeof localeContent.meta !== 'object' || Array.isArray(localeContent.meta)) {
                    localeContent.meta = {};
                }
                localeContent.meta.code = localeCode;
                if (!localeContent.meta.version) {
                    localeContent.meta.version = DEFAULT_LOCALE_VERSION;
                }
                await (0, fs_extra_1.writeJson)(localeFilePath, localeContent, { spaces: 2 });
                await this.refreshResourcesAssetDb();
                await this.refreshLocaleEntries();
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] 新增多语言文件失败:', error);
            }
            this.render();
        },
        async setTemplate(index) {
            const entry = this.getLocaleEntries()[index];
            if (!entry) {
                return;
            }
            const content = await this.readLocaleJson(entry.fullPath);
            const state = this.getState();
            state.templateLocale = {
                fileName: entry.fileName,
                content: cloneJson(content),
            };
            this.saveState(state);
            this.render();
        },
        async syncByLocale(index) {
            const entries = this.getLocaleEntries();
            const baseEntry = entries[index];
            if (!baseEntry) {
                return;
            }
            const targetEntries = entries.filter((_, entryIndex) => entryIndex !== index);
            if (!targetEntries.length) {
                console.warn('[brief-toolkit-plugin.i18n] 无可同步的目标多语言文件。');
                return;
            }
            try {
                const result = await Editor.Dialog.warn(`将以 ${baseEntry.fileName} 为基准同步其他 ${targetEntries.length} 份多语言文件。\n非 meta 节点会删除多余项并补齐缺失项，是否继续？`, {
                    title: '同步确认',
                    buttons: ['取消', '同步'],
                    default: 0,
                    cancel: 0,
                });
                if (!result || result.response !== 1) {
                    return;
                }
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] 同步确认弹窗调用失败:', error);
                return;
            }
            const baseContent = await this.readLocaleJson(baseEntry.fullPath);
            let changedCount = 0;
            for (const targetEntry of targetEntries) {
                try {
                    const targetContent = await this.readLocaleJson(targetEntry.fullPath);
                    const syncedContent = buildSyncedLocaleContent(baseContent, targetContent);
                    if (JSON.stringify(targetContent) === JSON.stringify(syncedContent)) {
                        continue;
                    }
                    await (0, fs_extra_1.writeJson)(targetEntry.fullPath, syncedContent, { spaces: 2 });
                    changedCount += 1;
                }
                catch (error) {
                    console.warn(`[brief-toolkit-plugin.i18n] 同步失败: ${targetEntry.fileName}`, error);
                }
            }
            await this.refreshResourcesAssetDb();
            await this.refreshLocaleEntries();
            this.render();
            console.log(`[brief-toolkit-plugin.i18n] 同步完成，基准文件: ${baseEntry.fileName}，更新文件数: ${changedCount}`);
        },
        async openDirectory(index) {
            var _a, _b;
            const entry = this.getLocaleEntries()[index];
            if (!entry) {
                return;
            }
            try {
                await Editor.Message.request('asset-db', 'open-asset', entry.dbPath);
                return;
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] asset-db open failed, fallback to shell:', error);
            }
            try {
                const electron = require('electron');
                if ((_a = electron === null || electron === void 0 ? void 0 : electron.shell) === null || _a === void 0 ? void 0 : _a.openPath) {
                    electron.shell.openPath(entry.fullPath);
                    return;
                }
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] Electron shell unavailable:', error);
            }
            if ((_b = Editor.Shell) === null || _b === void 0 ? void 0 : _b.openPath) {
                Editor.Shell.openPath(entry.fullPath);
                return;
            }
            console.warn(`[brief-toolkit-plugin.i18n] 无法打开文件: ${entry.fullPath}`);
        },
        async removeDirectory(index) {
            const entry = this.getLocaleEntries()[index];
            if (!entry) {
                return;
            }
            try {
                const result = await Editor.Dialog.warn(`确认删除多语言文件 ${entry.fileName} 吗？`, {
                    title: '删除确认',
                    buttons: ['取消', '删除'],
                    default: 0,
                    cancel: 0,
                });
                if (!result || result.response !== 1) {
                    return;
                }
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.i18n] 删除确认弹窗调用失败:', error);
                return;
            }
            await (0, fs_extra_1.remove)(entry.fullPath);
            await this.refreshResourcesAssetDb();
            await this.refreshLocaleEntries();
            this.render();
        },
        bindEvents() {
            const confirmBtn = this.$.confirmResourceDirBtn;
            const addBtn = this.$.addDirBtn;
            const newDirInput = this.$.newDirInput;
            const dirTableBody = this.$.dirTableBody;
            const resourceDirInput = this.$.resourceDirInput;
            confirmBtn === null || confirmBtn === void 0 ? void 0 : confirmBtn.addEventListener('click', () => {
                void this.handleConfirmResourceDir();
            });
            addBtn === null || addBtn === void 0 ? void 0 : addBtn.addEventListener('click', () => {
                void this.handleAddDirectory();
            });
            resourceDirInput === null || resourceDirInput === void 0 ? void 0 : resourceDirInput.addEventListener('blur', () => {
                void this.updateConfirmButtonMode();
            });
            newDirInput === null || newDirInput === void 0 ? void 0 : newDirInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    void this.handleAddDirectory();
                }
            });
            dirTableBody === null || dirTableBody === void 0 ? void 0 : dirTableBody.addEventListener('click', (event) => {
                const target = event.target;
                const button = target === null || target === void 0 ? void 0 : target.closest('button[data-action][data-index]');
                if (!button) {
                    return;
                }
                const action = button.dataset.action;
                const index = Number(button.dataset.index);
                if (Number.isNaN(index)) {
                    return;
                }
                if (action === 'open') {
                    void this.openDirectory(index);
                    return;
                }
                if (action === 'set-template') {
                    void this.setTemplate(index);
                    return;
                }
                if (action === 'sync') {
                    void this.syncByLocale(index);
                    return;
                }
                if (action === 'delete') {
                    void this.removeDirectory(index);
                }
            });
        },
        async initializePanel() {
            this.bindEvents();
            await this.loadState();
            await this.refreshLocaleEntries();
            this.render();
        },
    },
    ready() {
        void this.initializePanel();
    },
    beforeClose() { },
    close() { },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2kxOG4vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1Q0FBMkc7QUFDM0csK0JBQTRCO0FBQzVCLHlFQUFnRDtBQUVoRCxNQUFNLFlBQVksR0FBRyxzQkFBVyxDQUFDLElBQUksQ0FBQztBQUN0QyxNQUFNLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQztBQUNyQyxNQUFNLGlCQUFpQixHQUFHLHVCQUF1QixDQUFDO0FBQ2xELE1BQU0sZ0JBQWdCLEdBQUcsY0FBYyxDQUFDO0FBQ3hDLE1BQU0sc0JBQXNCLEdBQUcsT0FBTyxDQUFDO0FBRXZDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLE9BQU8sRUFBRSw4Q0FBOEM7SUFDdkQsR0FBRyxFQUFFLGNBQWM7SUFDbkIsS0FBSyxFQUFFLGtCQUFrQjtJQUN6QixJQUFJLEVBQUUsUUFBUTtJQUNkLFFBQVEsRUFBRSxDQUFDLE1BQU0sQ0FBQztJQUNsQixVQUFVLEVBQUU7UUFDUixJQUFJLEVBQUU7WUFDRixJQUFJLEVBQUUsUUFBUTtZQUNkLEtBQUssRUFBRSxhQUFhO1lBQ3BCLFFBQVEsRUFBRSxDQUFDLE1BQU0sQ0FBQztZQUNsQixVQUFVLEVBQUU7Z0JBQ1IsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLEtBQUssRUFBRSx5QkFBeUI7aUJBQ25DO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxLQUFLLEVBQUUsT0FBTztpQkFDakI7Z0JBQ0QsT0FBTyxFQUFFO29CQUNMLElBQUksRUFBRSxRQUFRO29CQUNkLEtBQUssRUFBRSxPQUFPO2lCQUNqQjthQUNKO1lBQ0Qsb0JBQW9CLEVBQUUsSUFBSTtTQUM3QjtLQUNKO0lBQ0Qsb0JBQW9CLEVBQUUsSUFBSTtDQUM3QixDQUFDO0FBdUJGLFNBQVMsWUFBWSxDQUFDLEtBQVU7SUFDNUIsT0FB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QUFJLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztvQkFDcEIsS0FBSyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUMvQixPQUFPO2dCQUNYLENBQUM7Z0JBQ0QsSUFBSSxNQUFNLEtBQUssY0FBYyxFQUFFLENBQUM7b0JBQzVCLEtBQUssSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDN0IsT0FBTztnQkFDWCxDQUFDO2dCQUNELElBQUksTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUNwQixLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzlCLE9BQU87Z0JBQ1gsQ0FBQztnQkFDRCxJQUFJLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztvQkFDdEIsS0FBSyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBQ0QsS0FBSyxDQUFDLGVBQWU7WUFDakIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLE1BQU0sSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2xCLENBQUM7S0FDSjtJQUNELEtBQUs7UUFDRCxLQUFLLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBQ0QsV0FBVyxLQUFJLENBQUM7SUFDaEIsS0FBSyxLQUFJLENBQUM7Q0FDYixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlbnN1cmVEaXIsIG1vdmUsIHBhdGhFeGlzdHMsIHJlYWRGaWxlU3luYywgcmVhZEpzb24sIHJlYWRkaXIsIHJlbW92ZSwgd3JpdGVKc29uIH0gZnJvbSAnZnMtZXh0cmEnO1xyXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XHJcbmltcG9ydCBwYWNrYWdlSlNPTiBmcm9tICcuLi8uLi8uLi9wYWNrYWdlLmpzb24nO1xyXG5cclxuY29uc3QgUEFDS0FHRV9OQU1FID0gcGFja2FnZUpTT04ubmFtZTtcclxuY29uc3QgUFJPRklMRV9LRVkgPSAnaTE4blBhbmVsU3RhdGUnO1xyXG5jb25zdCBSRVNPVVJDRVNfREJfUk9PVCA9ICdkYjovL2Fzc2V0cy9yZXNvdXJjZXMnO1xyXG5jb25zdCBTQ0hFTUFfRklMRV9OQU1FID0gJy5zY2hlbWEuanNvbic7XHJcbmNvbnN0IERFRkFVTFRfTE9DQUxFX1ZFUlNJT04gPSAnMS4wLjAnO1xyXG5cclxuY29uc3QgTE9DQUxFX1NDSEVNQSA9IHtcclxuICAgICRzY2hlbWE6ICdodHRwczovL2pzb24tc2NoZW1hLm9yZy9kcmFmdC8yMDIwLTEyL3NjaGVtYScsXHJcbiAgICAkaWQ6ICcuc2NoZW1hLmpzb24nLFxyXG4gICAgdGl0bGU6ICdpMThuIGxvY2FsZSBmaWxlJyxcclxuICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgcmVxdWlyZWQ6IFsnbWV0YSddLFxyXG4gICAgcHJvcGVydGllczoge1xyXG4gICAgICAgIG1ldGE6IHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHRpdGxlOiAn5aSa6K+t6KiA5paH5pysTWV0YeS/oeaBrycsXHJcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2NvZGUnXSxcclxuICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgY29kZToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5aSa6K+t6KiA57yW56CB77yI5Lmf5piv5aSa6K+t6KiA5paH5Lu25ZCN56ew77yM5Zu+54mH55uu5b2V5ZCN56ew77yJJyxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBuYW1lOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICflpJror63oqIDlkI3np7AnLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHZlcnNpb246IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ+WkmuivreiogOeJiOacrCcsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxyXG59O1xyXG5cclxudHlwZSBKc29uUmVjb3JkID0gUmVjb3JkPHN0cmluZywgYW55PjtcclxuXHJcbnR5cGUgTG9jYWxlVGVtcGxhdGUgPSB7XHJcbiAgICBmaWxlTmFtZTogc3RyaW5nO1xyXG4gICAgY29udGVudDogSnNvblJlY29yZDtcclxufTtcclxuXHJcbnR5cGUgSTE4blBhbmVsU3RhdGUgPSB7XHJcbiAgICByZXNvdXJjZURpcjogc3RyaW5nO1xyXG4gICAgdGVtcGxhdGVMb2NhbGU6IExvY2FsZVRlbXBsYXRlIHwgbnVsbDtcclxufTtcclxuXHJcbnR5cGUgTG9jYWxlRmlsZUVudHJ5ID0ge1xyXG4gICAgZmlsZU5hbWU6IHN0cmluZztcclxuICAgIGNvZGU6IHN0cmluZztcclxuICAgIGZ1bGxQYXRoOiBzdHJpbmc7XHJcbiAgICBkYlBhdGg6IHN0cmluZztcclxufTtcclxuXHJcbnR5cGUgQ29uZmlybU1vZGUgPSAnYWRkJyB8ICd0cmFuc2Zlcic7XHJcblxyXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWU6IGFueSk6IHZhbHVlIGlzIEpzb25SZWNvcmQge1xyXG4gICAgcmV0dXJuIEJvb2xlYW4odmFsdWUpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzeW5jTG9jYWxlTm9kZShiYXNlTm9kZTogSnNvblJlY29yZCwgdGFyZ2V0Tm9kZTogSnNvblJlY29yZCwgaXNSb290ID0gZmFsc2UpOiBKc29uUmVjb3JkIHtcclxuICAgIGNvbnN0IGJhc2UgPSBpc0pzb25PYmplY3QoYmFzZU5vZGUpID8gYmFzZU5vZGUgOiB7fTtcclxuICAgIGNvbnN0IHRhcmdldCA9IGlzSnNvbk9iamVjdCh0YXJnZXROb2RlKSA/IHRhcmdldE5vZGUgOiB7fTtcclxuICAgIGNvbnN0IHJlc3VsdDogSnNvblJlY29yZCA9IHt9O1xyXG5cclxuICAgIE9iamVjdC5rZXlzKGJhc2UpLmZvckVhY2goKGtleSkgPT4ge1xyXG4gICAgICAgIGlmIChpc1Jvb3QgJiYga2V5ID09PSAnbWV0YScpIHtcclxuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsICdtZXRhJykpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5tZXRhID0gY2xvbmVKc29uKHRhcmdldC5tZXRhKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5tZXRhID0gY2xvbmVKc29uKGJhc2UubWV0YSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgYmFzZVZhbHVlID0gYmFzZVtrZXldO1xyXG4gICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRhcmdldCwga2V5KSkge1xyXG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IGNsb25lSnNvbihiYXNlVmFsdWUpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0YXJnZXRWYWx1ZSA9IHRhcmdldFtrZXldO1xyXG4gICAgICAgIGlmIChpc0pzb25PYmplY3QoYmFzZVZhbHVlKSkge1xyXG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkVGFyZ2V0VmFsdWUgPSBpc0pzb25PYmplY3QodGFyZ2V0VmFsdWUpID8gdGFyZ2V0VmFsdWUgOiB7fTtcclxuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBzeW5jTG9jYWxlTm9kZShiYXNlVmFsdWUsIG5vcm1hbGl6ZWRUYXJnZXRWYWx1ZSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlc3VsdFtrZXldID0gY2xvbmVKc29uKHRhcmdldFZhbHVlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChpc1Jvb3QgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChyZXN1bHQsICdtZXRhJykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRhcmdldCwgJ21ldGEnKSkge1xyXG4gICAgICAgIHJlc3VsdC5tZXRhID0gY2xvbmVKc29uKHRhcmdldC5tZXRhKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZFN5bmNlZExvY2FsZUNvbnRlbnQoYmFzZUNvbnRlbnQ6IEpzb25SZWNvcmQsIHRhcmdldENvbnRlbnQ6IEpzb25SZWNvcmQpOiBKc29uUmVjb3JkIHtcclxuICAgIGNvbnN0IGJhc2VOb2RlID0gaXNKc29uT2JqZWN0KGJhc2VDb250ZW50KSA/IGJhc2VDb250ZW50IDoge307XHJcbiAgICBjb25zdCB0YXJnZXROb2RlID0gaXNKc29uT2JqZWN0KHRhcmdldENvbnRlbnQpID8gdGFyZ2V0Q29udGVudCA6IHt9O1xyXG5cclxuICAgIHJldHVybiBzeW5jTG9jYWxlTm9kZShiYXNlTm9kZSwgdGFyZ2V0Tm9kZSwgdHJ1ZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB2YWx1ZS50cmltKCkucmVwbGFjZSgvXltcXFxcL10rfFtcXFxcL10rJC9nLCAnJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdmFsdWVcclxuICAgICAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxyXG4gICAgICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuICAgICAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXHJcbiAgICAgICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxyXG4gICAgICAgIC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjbG9uZUpzb248VD4odmFsdWU6IFQpOiBUIHtcclxuICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHZhbHVlKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZUxvY2FsZUNvZGUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gbm9ybWFsaXplRGlyKHZhbHVlKS5yZXBsYWNlKC9cXC5qc29uJC9pLCAnJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZURlZmF1bHRMb2NhbGVDb250ZW50KGNvZGU6IHN0cmluZyk6IEpzb25SZWNvcmQge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICAkc2NoZW1hOiBTQ0hFTUFfRklMRV9OQU1FLFxyXG4gICAgICAgIG1ldGE6IHtcclxuICAgICAgICAgICAgY29kZSxcclxuICAgICAgICAgICAgdmVyc2lvbjogREVGQVVMVF9MT0NBTEVfVkVSU0lPTixcclxuICAgICAgICB9LFxyXG4gICAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmVzb3VyY2VzRnNSb290KCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gam9pbihFZGl0b3IuUHJvamVjdC5wYXRoLCAnYXNzZXRzJywgJ3Jlc291cmNlcycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0b1Jlc291cmNlRGJQYXRoKHJlbGF0aXZlRGlyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XHJcbiAgICByZXR1cm4gbm9ybWFsaXplZCA/IGAke1JFU09VUkNFU19EQl9ST09UfS8ke25vcm1hbGl6ZWR9YCA6IFJFU09VUkNFU19EQl9ST09UO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0b1Jlc291cmNlRnNQYXRoKHJlbGF0aXZlRGlyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XHJcbiAgICByZXR1cm4gbm9ybWFsaXplZCA/IGpvaW4oZ2V0UmVzb3VyY2VzRnNSb290KCksIG5vcm1hbGl6ZWQpIDogZ2V0UmVzb3VyY2VzRnNSb290KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRvTG9jYWxlRGJQYXRoKHJlc291cmNlRGlyOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGAke3RvUmVzb3VyY2VEYlBhdGgocmVzb3VyY2VEaXIpfS8ke2ZpbGVOYW1lfWA7XHJcbn1cclxuLyoqXHJcbiAqIEB6aCDlpoLmnpzluIzmnJvlhbzlrrkgMy4zIOS5i+WJjeeahOeJiOacrOWPr+S7peS9v+eUqOS4i+aWueeahOS7o+eggVxyXG4gKiBAZW4gWW91IGNhbiBhZGQgdGhlIGNvZGUgYmVsb3cgaWYgeW91IHdhbnQgY29tcGF0aWJpbGl0eSB3aXRoIHZlcnNpb25zIHByaW9yIHRvIDMuM1xyXG4gKi9cclxuLy8gRWRpdG9yLlBhbmVsLmRlZmluZSA9IEVkaXRvci5QYW5lbC5kZWZpbmUgfHwgZnVuY3Rpb24ob3B0aW9uczogYW55KSB7IHJldHVybiBvcHRpb25zIH1cclxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3IuUGFuZWwuZGVmaW5lKHtcclxuICAgIGxpc3RlbmVyczoge1xyXG4gICAgICAgIHNob3coKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzaG93Jyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoaWRlKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnaGlkZScpO1xyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgdGVtcGxhdGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy90ZW1wbGF0ZS9pMThuL2luZGV4Lmh0bWwnKSwgJ3V0Zi04JyksXHJcbiAgICBzdHlsZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3N0eWxlL2kxOG4vaW5kZXguY3NzJyksICd1dGYtOCcpLFxyXG4gICAgJDoge1xyXG4gICAgICAgIGFwcDogJyNhcHAnLFxyXG4gICAgICAgIHJlc291cmNlRGlySW5wdXQ6ICcjcmVzb3VyY2VEaXJJbnB1dCcsXHJcbiAgICAgICAgY29uZmlybVJlc291cmNlRGlyQnRuOiAnI2NvbmZpcm1SZXNvdXJjZURpckJ0bicsXHJcbiAgICAgICAgZGlyVGFibGVCb2R5OiAnI2RpclRhYmxlQm9keScsXHJcbiAgICAgICAgbmV3RGlySW5wdXQ6ICcjbmV3RGlySW5wdXQnLFxyXG4gICAgICAgIGFkZERpckJ0bjogJyNhZGREaXJCdG4nLFxyXG4gICAgfSxcclxuICAgIG1ldGhvZHM6IHtcclxuICAgICAgICBnZXREZWZhdWx0U3RhdGUoKTogSTE4blBhbmVsU3RhdGUge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VEaXI6ICcnLFxyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVMb2NhbGU6IG51bGwsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRTdGF0ZSgpOiBJMThuUGFuZWxTdGF0ZSB7XHJcbiAgICAgICAgICAgIHJldHVybiAoKHRoaXMgYXMgYW55KS5fc3RhdGUgYXMgSTE4blBhbmVsU3RhdGUpIHx8IHRoaXMuZ2V0RGVmYXVsdFN0YXRlKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRMb2NhbGVFbnRyaWVzKCk6IExvY2FsZUZpbGVFbnRyeVtdIHtcclxuICAgICAgICAgICAgcmV0dXJuICgodGhpcyBhcyBhbnkpLl9sb2NhbGVFbnRyaWVzIGFzIExvY2FsZUZpbGVFbnRyeVtdKSB8fCBbXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5vcm1hbGl6ZVRlbXBsYXRlTG9jYWxlKHRlbXBsYXRlTG9jYWxlOiBMb2NhbGVUZW1wbGF0ZSB8IG51bGwgfCB1bmRlZmluZWQpOiBMb2NhbGVUZW1wbGF0ZSB8IG51bGwge1xyXG4gICAgICAgICAgICBpZiAoIXRlbXBsYXRlTG9jYWxlIHx8IHR5cGVvZiB0ZW1wbGF0ZUxvY2FsZSAhPT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IFN0cmluZyh0ZW1wbGF0ZUxvY2FsZS5maWxlTmFtZSB8fCAnJykudHJpbSgpO1xyXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gdGVtcGxhdGVMb2NhbGUuY29udGVudDtcclxuICAgICAgICAgICAgaWYgKCFmaWxlTmFtZSB8fCAhY29udGVudCB8fCB0eXBlb2YgY29udGVudCAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShjb250ZW50KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZSxcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNsb25lSnNvbihjb250ZW50KSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5vcm1hbGl6ZVN0YXRlKHN0YXRlOiBQYXJ0aWFsPEkxOG5QYW5lbFN0YXRlPiB8IG51bGwgfCB1bmRlZmluZWQpOiBJMThuUGFuZWxTdGF0ZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRTdGF0ZSA9IHRoaXMuZ2V0RGVmYXVsdFN0YXRlKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlRGlyID0gbm9ybWFsaXplRGlyKHN0YXRlPy5yZXNvdXJjZURpciB8fCBkZWZhdWx0U3RhdGUucmVzb3VyY2VEaXIpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHJlc291cmNlRGlyLFxyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVMb2NhbGU6IHRoaXMubm9ybWFsaXplVGVtcGxhdGVMb2NhbGUoc3RhdGU/LnRlbXBsYXRlTG9jYWxlKSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGxvYWRTdGF0ZSgpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgRWRpdG9yLlByb2ZpbGUuZ2V0UHJvamVjdChQQUNLQUdFX05BTUUsIFBST0ZJTEVfS0VZKTtcclxuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX3N0YXRlID0gdGhpcy5ub3JtYWxpemVTdGF0ZShzdGF0ZSBhcyBQYXJ0aWFsPEkxOG5QYW5lbFN0YXRlPik7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSBGYWlsZWQgdG8gbG9hZCBwcm9maWxlIHN0YXRlOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX3N0YXRlID0gdGhpcy5nZXREZWZhdWx0U3RhdGUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2F2ZVN0YXRlKHN0YXRlOiBJMThuUGFuZWxTdGF0ZSkge1xyXG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkU3RhdGUgPSB0aGlzLm5vcm1hbGl6ZVN0YXRlKHN0YXRlKTtcclxuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fc3RhdGUgPSBub3JtYWxpemVkU3RhdGU7XHJcblxyXG4gICAgICAgICAgICB2b2lkIEVkaXRvci5Qcm9maWxlLnNldFByb2plY3QoUEFDS0FHRV9OQU1FLCBQUk9GSUxFX0tFWSwgbm9ybWFsaXplZFN0YXRlLCAncHJvamVjdCcpLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0gRmFpbGVkIHRvIHNhdmUgcHJvZmlsZSBzdGF0ZTonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0UmVzb3VyY2VEaXIoKTogc3RyaW5nIHtcclxuICAgICAgICAgICAgY29uc3QgaW5wdXQgPSB0aGlzLiQucmVzb3VyY2VEaXJJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZURpcihpbnB1dD8udmFsdWUgfHwgJycpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgZXhpc3RzSW5SZXNvdXJjZXNEYihyZWxhdGl2ZURpcjogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xyXG4gICAgICAgICAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdG9SZXNvdXJjZURiUGF0aChub3JtYWxpemVkKSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gQm9vbGVhbihpbmZvKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmkxOG5dIGFzc2V0LWRiIHF1ZXJ5IGZhaWxlZCwgZmFsbGJhY2sgdG8gZnMgZXhpc3RzOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoRXhpc3RzKHRvUmVzb3VyY2VGc1BhdGgobm9ybWFsaXplZCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyByZWZyZXNoUmVzb3VyY2VzQXNzZXREYigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCBSRVNPVVJDRVNfREJfUk9PVCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSBhc3NldC1kYiByZWZyZXNoIGZhaWxlZDonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGVuc3VyZVJlc291cmNlRGlyQ3JlYXRlZChyZWxhdGl2ZURpcjogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xyXG4gICAgICAgICAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VzRnNSb290ID0gZ2V0UmVzb3VyY2VzRnNSb290KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlc0V4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMocmVzb3VyY2VzRnNSb290KTtcclxuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZXNFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGVuc3VyZURpcihyZXNvdXJjZXNGc1Jvb3QpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBhd2FpdCBlbnN1cmVEaXIodG9SZXNvdXJjZUZzUGF0aChub3JtYWxpemVkKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBlbnN1cmVTY2hlbWFGaWxlKHJlbGF0aXZlRGlyOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XHJcbiAgICAgICAgICAgIGlmICghbm9ybWFsaXplZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkaXJQYXRoID0gdG9SZXNvdXJjZUZzUGF0aChub3JtYWxpemVkKTtcclxuICAgICAgICAgICAgYXdhaXQgZW5zdXJlRGlyKGRpclBhdGgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgc2NoZW1hUGF0aCA9IGpvaW4oZGlyUGF0aCwgU0NIRU1BX0ZJTEVfTkFNRSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNjaGVtYUV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMoc2NoZW1hUGF0aCk7XHJcbiAgICAgICAgICAgIGlmIChzY2hlbWFFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYXdhaXQgd3JpdGVKc29uKHNjaGVtYVBhdGgsIExPQ0FMRV9TQ0hFTUEsIHsgc3BhY2VzOiAyIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHBhdGhFeGlzdHMoc2NoZW1hUGF0aCk7XHJcbiAgICAgICAgICAgIGlmICghY3JlYXRlZCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0g5Yib5bu6IHNjaGVtYSDmlofku7blpLHotKU6ICR7c2NoZW1hUGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSDlt7LliJvlu7ogc2NoZW1hIOaWh+S7tjogJHtzY2hlbWFQYXRofWApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgdHJhbnNmZXJSZXNvdXJjZURpcihvbGREaXI6IHN0cmluZywgbmV3RGlyOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgY29uc3Qgb2xkTm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihvbGREaXIpO1xyXG4gICAgICAgICAgICBjb25zdCBuZXdOb3JtYWxpemVkID0gbm9ybWFsaXplRGlyKG5ld0Rpcik7XHJcblxyXG4gICAgICAgICAgICBpZiAoIW9sZE5vcm1hbGl6ZWQgfHwgIW5ld05vcm1hbGl6ZWQgfHwgb2xkTm9ybWFsaXplZCA9PT0gbmV3Tm9ybWFsaXplZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gdG9SZXNvdXJjZUZzUGF0aChvbGROb3JtYWxpemVkKTtcclxuICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHRvUmVzb3VyY2VGc1BhdGgobmV3Tm9ybWFsaXplZCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBvbGRFeGlzdHMgPSBhd2FpdCBwYXRoRXhpc3RzKG9sZFBhdGgpO1xyXG4gICAgICAgICAgICBpZiAoIW9sZEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDljp/nm67lvZXkuI3lrZjlnKg6ICR7b2xkUGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgbmV3RXhpc3RzID0gYXdhaXQgcGF0aEV4aXN0cyhuZXdQYXRoKTtcclxuICAgICAgICAgICAgaWYgKG5ld0V4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDnm67moIfnm67lvZXlt7LlrZjlnKg6ICR7bmV3UGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYXdhaXQgbW92ZShvbGRQYXRoLCBuZXdQYXRoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGxpc3RMb2NhbGVFbnRyaWVzKHJlbGF0aXZlRGlyOiBzdHJpbmcpOiBQcm9taXNlPExvY2FsZUZpbGVFbnRyeVtdPiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xyXG4gICAgICAgICAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgZGlyUGF0aCA9IHRvUmVzb3VyY2VGc1BhdGgobm9ybWFsaXplZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMoZGlyUGF0aCk7XHJcbiAgICAgICAgICAgIGlmICghZXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVOYW1lcyA9IChhd2FpdCByZWFkZGlyKGRpclBhdGgpKVxyXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoZmlsZU5hbWUpID0+IGZpbGVOYW1lLmVuZHNXaXRoKCcuanNvbicpICYmIGZpbGVOYW1lICE9PSBTQ0hFTUFfRklMRV9OQU1FKVxyXG4gICAgICAgICAgICAgICAgLnNvcnQoKGxlZnQsIHJpZ2h0KSA9PiBsZWZ0LmxvY2FsZUNvbXBhcmUocmlnaHQsICd6aC1DTicpKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBmaWxlTmFtZXMubWFwKChmaWxlTmFtZSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIGZpbGVOYW1lLFxyXG4gICAgICAgICAgICAgICAgY29kZTogZmlsZU5hbWUucmVwbGFjZSgvXFwuanNvbiQvaSwgJycpLFxyXG4gICAgICAgICAgICAgICAgZnVsbFBhdGg6IGpvaW4oZGlyUGF0aCwgZmlsZU5hbWUpLFxyXG4gICAgICAgICAgICAgICAgZGJQYXRoOiB0b0xvY2FsZURiUGF0aChub3JtYWxpemVkLCBmaWxlTmFtZSksXHJcbiAgICAgICAgICAgIH0pKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIHJlYWRMb2NhbGVKc29uKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEpzb25SZWNvcmQ+IHtcclxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRKc29uKGZpbGVQYXRoKTtcclxuICAgICAgICAgICAgaWYgKCFjb250ZW50IHx8IHR5cGVvZiBjb250ZW50ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGNvbnRlbnQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge307XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBjb250ZW50IGFzIEpzb25SZWNvcmQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBzeW5jVGVtcGxhdGVMb2NhbGUoZW50cmllczogTG9jYWxlRmlsZUVudHJ5W10pIHtcclxuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlbXBsYXRlRmlsZU5hbWUgPSBzdGF0ZS50ZW1wbGF0ZUxvY2FsZT8uZmlsZU5hbWUgfHwgJyc7XHJcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nVGVtcGxhdGUgPSB0ZW1wbGF0ZUZpbGVOYW1lID8gZW50cmllcy5maW5kKChlbnRyeSkgPT4gZW50cnkuZmlsZU5hbWUgPT09IHRlbXBsYXRlRmlsZU5hbWUpIDogdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFlbnRyaWVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLnRlbXBsYXRlTG9jYWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUudGVtcGxhdGVMb2NhbGUgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVN0YXRlKHN0YXRlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGV4aXN0aW5nVGVtcGxhdGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlyc3RFbnRyeSA9IGVudHJpZXNbMF07XHJcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0Q29udGVudCA9IGF3YWl0IHRoaXMucmVhZExvY2FsZUpzb24oZmlyc3RFbnRyeS5mdWxsUGF0aCk7XHJcbiAgICAgICAgICAgIHN0YXRlLnRlbXBsYXRlTG9jYWxlID0ge1xyXG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGZpcnN0RW50cnkuZmlsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjbG9uZUpzb24oZmlyc3RDb250ZW50KSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgdGhpcy5zYXZlU3RhdGUoc3RhdGUpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgcmVmcmVzaExvY2FsZUVudHJpZXMoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlRGlyID0gdGhpcy5nZXRTdGF0ZSgpLnJlc291cmNlRGlyO1xyXG4gICAgICAgICAgICBpZiAocmVzb3VyY2VEaXIpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlU2NoZW1hRmlsZShyZXNvdXJjZURpcik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCB0aGlzLmxpc3RMb2NhbGVFbnRyaWVzKHJlc291cmNlRGlyKTtcclxuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fbG9jYWxlRW50cmllcyA9IGVudHJpZXM7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc3luY1RlbXBsYXRlTG9jYWxlKGVudHJpZXMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgZ2V0VGVtcGxhdGVDb250ZW50KGVudHJpZXM6IExvY2FsZUZpbGVFbnRyeVtdKTogUHJvbWlzZTxKc29uUmVjb3JkPiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG4gICAgICAgICAgICBjb25zdCB0ZW1wbGF0ZUZpbGVOYW1lID0gc3RhdGUudGVtcGxhdGVMb2NhbGU/LmZpbGVOYW1lIHx8ICcnO1xyXG5cclxuICAgICAgICAgICAgbGV0IHRlbXBsYXRlRW50cnk6IExvY2FsZUZpbGVFbnRyeSB8IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKHRlbXBsYXRlRmlsZU5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlRW50cnkgPSBlbnRyaWVzLmZpbmQoKGVudHJ5KSA9PiBlbnRyeS5maWxlTmFtZSA9PT0gdGVtcGxhdGVGaWxlTmFtZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCF0ZW1wbGF0ZUVudHJ5ICYmIGVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZUVudHJ5ID0gZW50cmllc1swXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCF0ZW1wbGF0ZUVudHJ5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY3JlYXRlRGVmYXVsdExvY2FsZUNvbnRlbnQoJycpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBBbHdheXMgcmVhZCBmcm9tIHRoZSB0ZW1wbGF0ZSBsb2NhbGUgZmlsZSB0byBhdm9pZCB1c2luZyBzdGFsZSBjYWNoZWQgY29udGVudC5cclxuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGVDb250ZW50ID0gY2xvbmVKc29uKGF3YWl0IHRoaXMucmVhZExvY2FsZUpzb24odGVtcGxhdGVFbnRyeS5mdWxsUGF0aCkpO1xyXG5cclxuICAgICAgICAgICAgc3RhdGUudGVtcGxhdGVMb2NhbGUgPSB7XHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogdGVtcGxhdGVFbnRyeS5maWxlTmFtZSxcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNsb25lSnNvbih0ZW1wbGF0ZUNvbnRlbnQpLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnNhdmVTdGF0ZShzdGF0ZSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdGVtcGxhdGVDb250ZW50O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgdXBkYXRlQ29uZmlybUJ1dHRvbk1vZGUoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1dHRvbiA9IHRoaXMuJC5jb25maXJtUmVzb3VyY2VEaXJCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIWJ1dHRvbikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKTtcclxuICAgICAgICAgICAgY29uc3Qgc2F2ZWREaXIgPSBub3JtYWxpemVEaXIoc3RhdGUucmVzb3VyY2VEaXIpO1xyXG4gICAgICAgICAgICBjb25zdCBzYXZlZERpckV4aXN0cyA9IHNhdmVkRGlyID8gYXdhaXQgdGhpcy5leGlzdHNJblJlc291cmNlc0RiKHNhdmVkRGlyKSA6IGZhbHNlO1xyXG4gICAgICAgICAgICBjb25zdCBtb2RlOiBDb25maXJtTW9kZSA9IHNhdmVkRGlyRXhpc3RzID8gJ3RyYW5zZmVyJyA6ICdhZGQnO1xyXG5cclxuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fY29uZmlybU1vZGUgPSBtb2RlO1xyXG4gICAgICAgICAgICBidXR0b24udGV4dENvbnRlbnQgPSBtb2RlID09PSAndHJhbnNmZXInID8gJ+i9rOenuycgOiAn5re75YqgJztcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlbmRlckRpcmVjdG9yeVRhYmxlKGVudHJpZXM6IExvY2FsZUZpbGVFbnRyeVtdKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhYmxlQm9keSA9IHRoaXMuJC5kaXJUYWJsZUJvZHkgYXMgSFRNTFRhYmxlU2VjdGlvbkVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIXRhYmxlQm9keSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICB0YWJsZUJvZHkuaW5uZXJIVE1MID0gJzx0cj48dGQgY29sc3Bhbj1cIjZcIiBjbGFzcz1cImVtcHR5LXRpcFwiPuaaguaXoOWkmuivreiogOaWh+S7tu+8jOivt+WcqOS4i+aWueaWsOWinuOAgjwvdGQ+PC90cj4nO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCB0ZW1wbGF0ZUZpbGVOYW1lID0gdGhpcy5nZXRTdGF0ZSgpLnRlbXBsYXRlTG9jYWxlPy5maWxlTmFtZSB8fCAnJztcclxuICAgICAgICAgICAgY29uc3QgY2FuU3luYyA9IGVudHJpZXMubGVuZ3RoID4gMTtcclxuXHJcbiAgICAgICAgICAgIHRhYmxlQm9keS5pbm5lckhUTUwgPSBlbnRyaWVzXHJcbiAgICAgICAgICAgICAgICAubWFwKFxyXG4gICAgICAgICAgICAgICAgICAgIChlbnRyeSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNUZW1wbGF0ZSA9IGVudHJ5LmZpbGVOYW1lID09PSB0ZW1wbGF0ZUZpbGVOYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkPiR7ZXNjYXBlSHRtbChlbnRyeS5jb2RlKX08L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjxzcGFuIGNsYXNzPVwidGVtcGxhdGUtZmxhZ1wiPiR7aXNUZW1wbGF0ZSA/ICfmmK8nIDogJ+WQpid9PC9zcGFuPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz1cInRhYmxlLWFjdGlvbi1idG5cIiB0eXBlPVwiYnV0dG9uXCIgZGF0YS1hY3Rpb249XCJzZXQtdGVtcGxhdGVcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiAke2lzVGVtcGxhdGUgPyAnZGlzYWJsZWQnIDogJyd9PiR7aXNUZW1wbGF0ZSA/ICflvZPliY3mqKHmnb8nIDogJ+iuvuS4uuaooeadvyd9PC9idXR0b24+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48YnV0dG9uIGNsYXNzPVwidGFibGUtYWN0aW9uLWJ0blwiIHR5cGU9XCJidXR0b25cIiBkYXRhLWFjdGlvbj1cInN5bmNcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiAke2NhblN5bmMgPyAnJyA6ICdkaXNhYmxlZCd9PuWQjOatpTwvYnV0dG9uPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz1cInRhYmxlLWFjdGlvbi1idG5cIiB0eXBlPVwiYnV0dG9uXCIgZGF0YS1hY3Rpb249XCJvcGVuXCIgZGF0YS1pbmRleD1cIiR7aW5kZXh9XCI+5omT5byAPC9idXR0b24+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48YnV0dG9uIGNsYXNzPVwidGFibGUtYWN0aW9uLWJ0biB0YWJsZS1hY3Rpb24tYnRuLWRhbmdlclwiIHR5cGU9XCJidXR0b25cIiBkYXRhLWFjdGlvbj1cImRlbGV0ZVwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiPuWIoOmZpDwvYnV0dG9uPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+YFxyXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAuam9pbignJyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZW5kZXIoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZURpcklucHV0ID0gdGhpcy4kLnJlc291cmNlRGlySW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld0RpcklucHV0ID0gdGhpcy4kLm5ld0RpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xyXG5cclxuICAgICAgICAgICAgaWYgKHJlc291cmNlRGlySW5wdXQpIHtcclxuICAgICAgICAgICAgICAgIHJlc291cmNlRGlySW5wdXQudmFsdWUgPSBzdGF0ZS5yZXNvdXJjZURpcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAobmV3RGlySW5wdXQpIHtcclxuICAgICAgICAgICAgICAgIG5ld0RpcklucHV0LnZhbHVlID0gJyc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJEaXJlY3RvcnlUYWJsZSh0aGlzLmdldExvY2FsZUVudHJpZXMoKSk7XHJcbiAgICAgICAgICAgIHZvaWQgdGhpcy51cGRhdGVDb25maXJtQnV0dG9uTW9kZSgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgaGFuZGxlQ29uZmlybVJlc291cmNlRGlyKCkge1xyXG4gICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKTtcclxuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VEaXIgPSB0aGlzLmdldFJlc291cmNlRGlyKCk7XHJcbiAgICAgICAgICAgIGlmICghcmVzb3VyY2VEaXIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmkxOG5dIOivt+WFiOi+k+WFpeWkmuivreiogOebruW9leOAgicpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBtb2RlOiBDb25maXJtTW9kZSA9ICgodGhpcyBhcyBhbnkpLl9jb25maXJtTW9kZSBhcyBDb25maXJtTW9kZSkgfHwgJ2FkZCc7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG1vZGUgPT09ICd0cmFuc2ZlcicpIHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnRyYW5zZmVyUmVzb3VyY2VEaXIoc3RhdGUucmVzb3VyY2VEaXIsIHJlc291cmNlRGlyKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW2JyaWVmLXRvb2xraXQtcGx1Z2luLmkxOG5dIOW3suWwhuebruW9leS7jiAke3N0YXRlLnJlc291cmNlRGlyfSDovaznp7vkuLogJHtyZXNvdXJjZURpcn1gKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVSZXNvdXJjZURpckNyZWF0ZWQocmVzb3VyY2VEaXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0g5bey5re75Yqg55uu5b2VOiAke3RvUmVzb3VyY2VEYlBhdGgocmVzb3VyY2VEaXIpfWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlU2NoZW1hRmlsZShyZXNvdXJjZURpcik7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NoZW1hUGF0aCA9IGpvaW4odG9SZXNvdXJjZUZzUGF0aChyZXNvdXJjZURpciksIFNDSEVNQV9GSUxFX05BTUUpO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NoZW1hRXhpc3RzID0gYXdhaXQgcGF0aEV4aXN0cyhzY2hlbWFQYXRoKTtcclxuICAgICAgICAgICAgICAgIGlmICghc2NoZW1hRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0gc2NoZW1hIOaWh+S7tue8uuWksTogJHtzY2hlbWFQYXRofWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0gc2NoZW1hIOagoemqjOmAmui/hzogJHtzY2hlbWFQYXRofWApO1xyXG4gICAgICAgICAgICAgICAgc3RhdGUucmVzb3VyY2VEaXIgPSByZXNvdXJjZURpcjtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVN0YXRlKHN0YXRlKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaExvY2FsZUVudHJpZXMoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSDorr7nva7nm67lvZXlpLHotKU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBoYW5kbGVBZGREaXJlY3RvcnkoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld0RpcklucHV0ID0gdGhpcy4kLm5ld0RpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIW5ld0RpcklucHV0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlRGlyID0gdGhpcy5nZXRTdGF0ZSgpLnJlc291cmNlRGlyIHx8IHRoaXMuZ2V0UmVzb3VyY2VEaXIoKTtcclxuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZURpcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0g6K+35YWI6YWN572u5aSa6K+t6KiA6LWE5rqQ55uu5b2V44CCJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsZUNvZGUgPSBub3JtYWxpemVMb2NhbGVDb2RlKG5ld0RpcklucHV0LnZhbHVlIHx8ICcnKTtcclxuICAgICAgICAgICAgaWYgKCFsb2NhbGVDb2RlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVJlc291cmNlRGlyQ3JlYXRlZChyZXNvdXJjZURpcik7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVNjaGVtYUZpbGUocmVzb3VyY2VEaXIpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2FsZUZpbGVOYW1lID0gYCR7bG9jYWxlQ29kZX0uanNvbmA7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsb2NhbGVGaWxlUGF0aCA9IGpvaW4odG9SZXNvdXJjZUZzUGF0aChyZXNvdXJjZURpciksIGxvY2FsZUZpbGVOYW1lKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMobG9jYWxlRmlsZVBhdGgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld0RpcklucHV0LnZhbHVlID0gJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0g5aSa6K+t6KiA5paH5Lu25bey5a2Y5ZyoOiAke2xvY2FsZUZpbGVOYW1lfWApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgdGhpcy5saXN0TG9jYWxlRW50cmllcyhyZXNvdXJjZURpcik7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsb2NhbGVDb250ZW50ID0gIWVudHJpZXMubGVuZ3RoXHJcbiAgICAgICAgICAgICAgICAgICAgPyBjcmVhdGVEZWZhdWx0TG9jYWxlQ29udGVudChsb2NhbGVDb2RlKVxyXG4gICAgICAgICAgICAgICAgICAgIDogYXdhaXQgdGhpcy5nZXRUZW1wbGF0ZUNvbnRlbnQoZW50cmllcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgbG9jYWxlQ29udGVudC4kc2NoZW1hID0gU0NIRU1BX0ZJTEVfTkFNRTtcclxuICAgICAgICAgICAgICAgIGlmICghbG9jYWxlQ29udGVudC5tZXRhIHx8IHR5cGVvZiBsb2NhbGVDb250ZW50Lm1ldGEgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkobG9jYWxlQ29udGVudC5tZXRhKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsZUNvbnRlbnQubWV0YSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbG9jYWxlQ29udGVudC5tZXRhLmNvZGUgPSBsb2NhbGVDb2RlO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFsb2NhbGVDb250ZW50Lm1ldGEudmVyc2lvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsZUNvbnRlbnQubWV0YS52ZXJzaW9uID0gREVGQVVMVF9MT0NBTEVfVkVSU0lPTjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBhd2FpdCB3cml0ZUpzb24obG9jYWxlRmlsZVBhdGgsIGxvY2FsZUNvbnRlbnQsIHsgc3BhY2VzOiAyIH0pO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoUmVzb3VyY2VzQXNzZXREYigpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoTG9jYWxlRW50cmllcygpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0g5paw5aKe5aSa6K+t6KiA5paH5Lu25aSx6LSlOicsIGVycm9yKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIHNldFRlbXBsYXRlKGluZGV4OiBudW1iZXIpIHtcclxuICAgICAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmdldExvY2FsZUVudHJpZXMoKVtpbmRleF07XHJcbiAgICAgICAgICAgIGlmICghZW50cnkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMucmVhZExvY2FsZUpzb24oZW50cnkuZnVsbFBhdGgpO1xyXG4gICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKTtcclxuICAgICAgICAgICAgc3RhdGUudGVtcGxhdGVMb2NhbGUgPSB7XHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogZW50cnkuZmlsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjbG9uZUpzb24oY29udGVudCksXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuc2F2ZVN0YXRlKHN0YXRlKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIHN5bmNCeUxvY2FsZShpbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSB0aGlzLmdldExvY2FsZUVudHJpZXMoKTtcclxuICAgICAgICAgICAgY29uc3QgYmFzZUVudHJ5ID0gZW50cmllc1tpbmRleF07XHJcbiAgICAgICAgICAgIGlmICghYmFzZUVudHJ5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldEVudHJpZXMgPSBlbnRyaWVzLmZpbHRlcigoXywgZW50cnlJbmRleCkgPT4gZW50cnlJbmRleCAhPT0gaW5kZXgpO1xyXG4gICAgICAgICAgICBpZiAoIXRhcmdldEVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSDml6Dlj6/lkIzmraXnmoTnm67moIflpJror63oqIDmlofku7bjgIInKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5EaWFsb2cud2Fybihg5bCG5LulICR7YmFzZUVudHJ5LmZpbGVOYW1lfSDkuLrln7rlh4blkIzmraXlhbbku5YgJHt0YXJnZXRFbnRyaWVzLmxlbmd0aH0g5Lu95aSa6K+t6KiA5paH5Lu244CCXFxu6Z2eIG1ldGEg6IqC54K55Lya5Yig6Zmk5aSa5L2Z6aG55bm26KGl6b2Q57y65aSx6aG577yM5piv5ZCm57un57ut77yfYCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5ZCM5q2l56Gu6K6kJyxcclxuICAgICAgICAgICAgICAgICAgICBidXR0b25zOiBbJ+WPlua2iCcsICflkIzmraUnXSxcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbmNlbDogMCxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghcmVzdWx0IHx8IHJlc3VsdC5yZXNwb25zZSAhPT0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmkxOG5dIOWQjOatpeehruiupOW8ueeql+iwg+eUqOWksei0pTonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGJhc2VDb250ZW50ID0gYXdhaXQgdGhpcy5yZWFkTG9jYWxlSnNvbihiYXNlRW50cnkuZnVsbFBhdGgpO1xyXG4gICAgICAgICAgICBsZXQgY2hhbmdlZENvdW50ID0gMDtcclxuXHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0RW50cnkgb2YgdGFyZ2V0RW50cmllcykge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRDb250ZW50ID0gYXdhaXQgdGhpcy5yZWFkTG9jYWxlSnNvbih0YXJnZXRFbnRyeS5mdWxsUGF0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3luY2VkQ29udGVudCA9IGJ1aWxkU3luY2VkTG9jYWxlQ29udGVudChiYXNlQ29udGVudCwgdGFyZ2V0Q29udGVudCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChKU09OLnN0cmluZ2lmeSh0YXJnZXRDb250ZW50KSA9PT0gSlNPTi5zdHJpbmdpZnkoc3luY2VkQ29udGVudCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB3cml0ZUpzb24odGFyZ2V0RW50cnkuZnVsbFBhdGgsIHN5bmNlZENvbnRlbnQsIHsgc3BhY2VzOiAyIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRDb3VudCArPSAxO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSDlkIzmraXlpLHotKU6ICR7dGFyZ2V0RW50cnkuZmlsZU5hbWV9YCwgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlZnJlc2hSZXNvdXJjZXNBc3NldERiKCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaExvY2FsZUVudHJpZXMoKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uaTE4bl0g5ZCM5q2l5a6M5oiQ77yM5Z+65YeG5paH5Lu2OiAke2Jhc2VFbnRyeS5maWxlTmFtZX3vvIzmm7TmlrDmlofku7bmlbA6ICR7Y2hhbmdlZENvdW50fWApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgb3BlbkRpcmVjdG9yeShpbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5nZXRMb2NhbGVFbnRyaWVzKClbaW5kZXhdO1xyXG4gICAgICAgICAgICBpZiAoIWVudHJ5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdvcGVuLWFzc2V0JywgZW50cnkuZGJQYXRoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmkxOG5dIGFzc2V0LWRiIG9wZW4gZmFpbGVkLCBmYWxsYmFjayB0byBzaGVsbDonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVjdHJvbiA9IHJlcXVpcmUoJ2VsZWN0cm9uJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoZWxlY3Ryb24/LnNoZWxsPy5vcGVuUGF0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZWN0cm9uLnNoZWxsLm9wZW5QYXRoKGVudHJ5LmZ1bGxQYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSBFbGVjdHJvbiBzaGVsbCB1bmF2YWlsYWJsZTonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICgoRWRpdG9yIGFzIGFueSkuU2hlbGw/Lm9wZW5QYXRoKSB7XHJcbiAgICAgICAgICAgICAgICAoRWRpdG9yIGFzIGFueSkuU2hlbGwub3BlblBhdGgoZW50cnkuZnVsbFBhdGgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFticmllZi10b29sa2l0LXBsdWdpbi5pMThuXSDml6Dms5XmiZPlvIDmlofku7Y6ICR7ZW50cnkuZnVsbFBhdGh9YCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyByZW1vdmVEaXJlY3RvcnkoaW5kZXg6IG51bWJlcikge1xyXG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuZ2V0TG9jYWxlRW50cmllcygpW2luZGV4XTtcclxuICAgICAgICAgICAgaWYgKCFlbnRyeSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLkRpYWxvZy53YXJuKGDnoa7orqTliKDpmaTlpJror63oqIDmlofku7YgJHtlbnRyeS5maWxlTmFtZX0g5ZCX77yfYCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5Yig6Zmk56Gu6K6kJyxcclxuICAgICAgICAgICAgICAgICAgICBidXR0b25zOiBbJ+WPlua2iCcsICfliKDpmaQnXSxcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbmNlbDogMCxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghcmVzdWx0IHx8IHJlc3VsdC5yZXNwb25zZSAhPT0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmkxOG5dIOWIoOmZpOehruiupOW8ueeql+iwg+eUqOWksei0pTonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGF3YWl0IHJlbW92ZShlbnRyeS5mdWxsUGF0aCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoTG9jYWxlRW50cmllcygpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYmluZEV2ZW50cygpIHtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlybUJ0biA9IHRoaXMuJC5jb25maXJtUmVzb3VyY2VEaXJCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBjb25zdCBhZGRCdG4gPSB0aGlzLiQuYWRkRGlyQnRuIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgY29uc3QgbmV3RGlySW5wdXQgPSB0aGlzLiQubmV3RGlySW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnN0IGRpclRhYmxlQm9keSA9IHRoaXMuJC5kaXJUYWJsZUJvZHkgYXMgSFRNTFRhYmxlU2VjdGlvbkVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZURpcklucHV0ID0gdGhpcy4kLnJlc291cmNlRGlySW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XHJcblxyXG4gICAgICAgICAgICBjb25maXJtQnRuPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5oYW5kbGVDb25maXJtUmVzb3VyY2VEaXIoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGFkZEJ0bj8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2b2lkIHRoaXMuaGFuZGxlQWRkRGlyZWN0b3J5KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXNvdXJjZURpcklucHV0Py5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdm9pZCB0aGlzLnVwZGF0ZUNvbmZpcm1CdXR0b25Nb2RlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBuZXdEaXJJbnB1dD8uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5oYW5kbGVBZGREaXJlY3RvcnkoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBkaXJUYWJsZUJvZHk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50OiBFdmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1dHRvbiA9IHRhcmdldD8uY2xvc2VzdCgnYnV0dG9uW2RhdGEtYWN0aW9uXVtkYXRhLWluZGV4XScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgICAgIGlmICghYnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdGlvbiA9IGJ1dHRvbi5kYXRhc2V0LmFjdGlvbjtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gTnVtYmVyKGJ1dHRvbi5kYXRhc2V0LmluZGV4KTtcclxuICAgICAgICAgICAgICAgIGlmIChOdW1iZXIuaXNOYU4oaW5kZXgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChhY3Rpb24gPT09ICdvcGVuJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5vcGVuRGlyZWN0b3J5KGluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnc2V0LXRlbXBsYXRlJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5zZXRUZW1wbGF0ZShpbmRleCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ3N5bmMnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdm9pZCB0aGlzLnN5bmNCeUxvY2FsZShpbmRleCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2RlbGV0ZScpIHtcclxuICAgICAgICAgICAgICAgICAgICB2b2lkIHRoaXMucmVtb3ZlRGlyZWN0b3J5KGluZGV4KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBpbml0aWFsaXplUGFuZWwoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmluZEV2ZW50cygpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRTdGF0ZSgpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlZnJlc2hMb2NhbGVFbnRyaWVzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICByZWFkeSgpIHtcclxuICAgICAgICB2b2lkIHRoaXMuaW5pdGlhbGl6ZVBhbmVsKCk7XHJcbiAgICB9LFxyXG4gICAgYmVmb3JlQ2xvc2UoKSB7fSxcclxuICAgIGNsb3NlKCkge30sXHJcbn0pO1xyXG4iXX0=