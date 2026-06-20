"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const package_json_1 = __importDefault(require("../../../package.json"));
const PACKAGE_NAME = package_json_1.default.name;
const PROFILE_KEY = 'guidePanelState';
const RESOURCES_DB_ROOT = 'db://assets/resources';
const SCHEMA_FILE_NAME = '.schema.json';
const GUIDE_FILE_SUFFIX = '.guide.json';
const GUIDE_TASK_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: '.schema.json',
    title: 'guide task schema',
    type: 'object',
    required: ['key', 'steps'],
    properties: {
        key: {
            type: 'string',
            title: '任务标识',
        },
        steps: {
            type: 'array',
            title: '步骤列表',
            items: {
                type: 'object',
                title: '步骤对象',
                required: ['target'],
                properties: {
                    target: {
                        type: 'string',
                        title: '目标节点路径',
                    },
                    title: {
                        type: 'string',
                        title: '步骤标题（可选）',
                    },
                    description: {
                        type: 'string',
                        title: '步骤描述（可选）',
                    },
                    eventData: {
                        type: 'object',
                        title: '步骤事件数据（可选）',
                    },
                },
            },
        },
    },
};
function normalizeDir(value) {
    return value.trim().replace(/^[\\/]+|[\\/]+$/g, '');
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
function normalizeGuideName(value) {
    return value.trim().replace(/\.guide\.json$/i, '').replace(/[\\/]+/g, '');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * @zh 如果希望兼容 3.3 之前的版本可以使用下方的代码
 * @en You can add the code below if you want compatibility with versions prior to 3.3
 */
// Editor.Panel.define = Editor.Panel.define || function(options: any) { return options }
module.exports = Editor.Panel.define({
    listeners: {
        show() {
            void this.refreshPanel();
        },
        hide() {
            console.log('hide');
        },
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/guide/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/guide/index.css'), 'utf-8'),
    $: {
        resourceDirInput: '#resourceDirInput',
        confirmResourceDirBtn: '#confirmResourceDirBtn',
        guideTableBody: '#guideTableBody',
        newGuideInput: '#newGuideInput',
        addGuideBtn: '#addGuideBtn',
    },
    methods: {
        getDefaultState() {
            return {
                resourceDir: '',
            };
        },
        getState() {
            return this._state || this.getDefaultState();
        },
        normalizeState(state) {
            return {
                resourceDir: normalizeDir((state === null || state === void 0 ? void 0 : state.resourceDir) || ''),
            };
        },
        getGuideEntries() {
            return this._guideEntries || [];
        },
        async loadState() {
            try {
                const state = await Editor.Profile.getProject(PACKAGE_NAME, PROFILE_KEY);
                this._state = this.normalizeState(state);
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.guide] Failed to load profile state:', error);
                this._state = this.getDefaultState();
            }
        },
        saveState(state) {
            const normalizedState = this.normalizeState(state);
            this._state = normalizedState;
            void Editor.Profile.setProject(PACKAGE_NAME, PROFILE_KEY, normalizedState, 'project').catch((error) => {
                console.warn('[brief-toolkit-plugin.guide] Failed to save profile state:', error);
            });
        },
        getResourceDirInputValue() {
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
                console.warn('[brief-toolkit-plugin.guide] asset-db query failed, fallback to fs exists:', error);
                return (0, fs_extra_1.pathExists)(toResourceFsPath(normalized));
            }
        },
        async refreshResourcesAssetDb() {
            try {
                await Editor.Message.request('asset-db', 'refresh-asset', RESOURCES_DB_ROOT);
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.guide] asset-db refresh failed:', error);
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
        async ensureGuideSchema(relativeDir) {
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
            await (0, fs_extra_1.writeJson)(schemaPath, GUIDE_TASK_SCHEMA, { spaces: 2 });
        },
        async listGuideEntries(relativeDir) {
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
                .filter((fileName) => fileName.endsWith(GUIDE_FILE_SUFFIX))
                .sort((left, right) => left.localeCompare(right, 'zh-CN'));
            return fileNames.map((fileName) => ({
                displayName: fileName.replace(/\.guide\.json$/i, ''),
                fileName,
                fullPath: (0, path_1.join)(dirPath, fileName),
                dbPath: `${toResourceDbPath(normalized)}/${fileName}`,
            }));
        },
        async refreshGuideEntries() {
            const resourceDir = this.getState().resourceDir;
            this._guideEntries = await this.listGuideEntries(resourceDir);
        },
        async updateConfirmButtonMode() {
            const button = this.$.confirmResourceDirBtn;
            if (!button) {
                return;
            }
            const state = this.getState();
            const currentDir = normalizeDir(state.resourceDir);
            const inputDir = this.getResourceDirInputValue();
            const currentExists = currentDir ? await this.existsInResourcesDb(currentDir) : false;
            const inputExists = inputDir ? await this.existsInResourcesDb(inputDir) : false;
            const mode = inputDir && (inputExists || (currentExists && inputDir !== currentDir)) ? 'transfer' : 'add';
            this._confirmMode = mode;
            button.textContent = mode === 'transfer' ? '转移' : '添加';
        },
        async render() {
            const input = this.$.resourceDirInput;
            const newGuideInput = this.$.newGuideInput;
            const state = this.getState();
            if (input) {
                input.value = state.resourceDir;
            }
            if (newGuideInput) {
                newGuideInput.value = '';
            }
            this.renderGuideTable(this.getGuideEntries());
            await this.updateConfirmButtonMode();
        },
        renderGuideTable(entries) {
            const tableBody = this.$.guideTableBody;
            if (!tableBody) {
                return;
            }
            if (!entries.length) {
                tableBody.innerHTML = '<tr><td colspan="3" class="empty-tip">暂无引导文件，请在下方新增。</td></tr>';
                return;
            }
            tableBody.innerHTML = entries
                .map((entry, index) => `<tr>
                            <td title="${escapeHtml(entry.fileName)}">${escapeHtml(entry.displayName)}</td>
                            <td><button class="table-action-btn" type="button" data-action="open" data-index="${index}">打开</button></td>
                            <td><button class="table-action-btn table-action-btn-danger" type="button" data-action="delete" data-index="${index}">删除</button></td>
                        </tr>`)
                .join('');
        },
        async handleConfirmResourceDir() {
            const targetDir = this.getResourceDirInputValue();
            if (!targetDir) {
                console.warn('[brief-toolkit-plugin.guide] 请先输入引导资源目录。');
                return;
            }
            const state = this.getState();
            const currentDir = normalizeDir(state.resourceDir);
            const mode = this._confirmMode || 'add';
            const targetExists = await this.existsInResourcesDb(targetDir);
            try {
                if (mode === 'transfer') {
                    if (targetExists) {
                        console.log(`[brief-toolkit-plugin.guide] 已切换到现有目录: ${toResourceDbPath(targetDir)}`);
                    }
                    else if (currentDir && currentDir !== targetDir) {
                        await this.transferResourceDir(currentDir, targetDir);
                        console.log(`[brief-toolkit-plugin.guide] 已将目录从 ${currentDir} 转移为 ${targetDir}`);
                    }
                    else {
                        await this.ensureResourceDirCreated(targetDir);
                    }
                }
                else {
                    await this.ensureResourceDirCreated(targetDir);
                    console.log(`[brief-toolkit-plugin.guide] 已添加目录: ${toResourceDbPath(targetDir)}`);
                }
                await this.ensureGuideSchema(targetDir);
                state.resourceDir = targetDir;
                this.saveState(state);
                await this.refreshResourcesAssetDb();
                await this.refreshGuideEntries();
                await this.render();
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.guide] 设置目录失败:', error);
            }
        },
        async handleAddGuide() {
            const newGuideInput = this.$.newGuideInput;
            if (!newGuideInput) {
                return;
            }
            const resourceDir = this.getState().resourceDir || this.getResourceDirInputValue();
            if (!resourceDir) {
                console.warn('[brief-toolkit-plugin.guide] 请先配置引导资源目录。');
                return;
            }
            const guideName = normalizeGuideName(newGuideInput.value || '');
            if (!guideName) {
                return;
            }
            try {
                await this.ensureResourceDirCreated(resourceDir);
                await this.ensureGuideSchema(resourceDir);
                const fileName = `${guideName}${GUIDE_FILE_SUFFIX}`;
                const filePath = (0, path_1.join)(toResourceFsPath(resourceDir), fileName);
                const exists = await (0, fs_extra_1.pathExists)(filePath);
                if (exists) {
                    console.warn(`[brief-toolkit-plugin.guide] 引导文件已存在: ${fileName}`);
                    return;
                }
                await (0, fs_extra_1.writeJson)(filePath, {
                    $schema: SCHEMA_FILE_NAME,
                    key: guideName,
                    steps: [],
                }, { spaces: 2 });
                await this.refreshResourcesAssetDb();
                await this.refreshGuideEntries();
                await this.render();
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.guide] 新增引导文件失败:', error);
            }
        },
        async openGuide(index) {
            var _a, _b;
            const entry = this.getGuideEntries()[index];
            if (!entry) {
                return;
            }
            try {
                await Editor.Message.request('asset-db', 'open-asset', entry.dbPath);
                return;
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.guide] asset-db open failed, fallback to shell:', error);
            }
            try {
                const electron = require('electron');
                if ((_a = electron === null || electron === void 0 ? void 0 : electron.shell) === null || _a === void 0 ? void 0 : _a.openPath) {
                    electron.shell.openPath(entry.fullPath);
                    return;
                }
            }
            catch (error) {
                console.warn('[brief-toolkit-plugin.guide] Electron shell unavailable:', error);
            }
            if ((_b = Editor.Shell) === null || _b === void 0 ? void 0 : _b.openPath) {
                Editor.Shell.openPath(entry.fullPath);
                return;
            }
            console.warn(`[brief-toolkit-plugin.guide] 无法打开文件: ${entry.fullPath}`);
        },
        async removeGuide(index) {
            const entry = this.getGuideEntries()[index];
            if (!entry) {
                return;
            }
            try {
                const result = await Editor.Dialog.warn(`确认删除引导文件 ${entry.fileName} 吗？`, {
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
                console.warn('[brief-toolkit-plugin.guide] 删除确认弹窗调用失败:', error);
                return;
            }
            await (0, fs_extra_1.remove)(entry.fullPath);
            await this.refreshResourcesAssetDb();
            await this.refreshGuideEntries();
            await this.render();
        },
        bindEvents() {
            if (this._eventsBound) {
                return;
            }
            const confirmBtn = this.$.confirmResourceDirBtn;
            const input = this.$.resourceDirInput;
            const addGuideBtn = this.$.addGuideBtn;
            const newGuideInput = this.$.newGuideInput;
            const guideTableBody = this.$.guideTableBody;
            confirmBtn === null || confirmBtn === void 0 ? void 0 : confirmBtn.addEventListener('click', () => {
                void this.handleConfirmResourceDir();
            });
            addGuideBtn === null || addGuideBtn === void 0 ? void 0 : addGuideBtn.addEventListener('click', () => {
                void this.handleAddGuide();
            });
            input === null || input === void 0 ? void 0 : input.addEventListener('input', () => {
                void this.updateConfirmButtonMode();
            });
            input === null || input === void 0 ? void 0 : input.addEventListener('blur', () => {
                void this.updateConfirmButtonMode();
            });
            input === null || input === void 0 ? void 0 : input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    void this.handleConfirmResourceDir();
                }
            });
            newGuideInput === null || newGuideInput === void 0 ? void 0 : newGuideInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    void this.handleAddGuide();
                }
            });
            guideTableBody === null || guideTableBody === void 0 ? void 0 : guideTableBody.addEventListener('click', (event) => {
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
                    void this.openGuide(index);
                    return;
                }
                if (action === 'delete') {
                    void this.removeGuide(index);
                }
            });
            this._eventsBound = true;
        },
        async refreshPanel() {
            await this.loadState();
            await this.refreshGuideEntries();
            await this.render();
        },
        async initializePanel() {
            this.bindEvents();
            await this.refreshPanel();
        },
    },
    ready() {
        void this.initializePanel();
    },
    beforeClose() { },
    close() { },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2d1aWRlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUNBQWlHO0FBQ2pHLCtCQUE0QjtBQUM1Qix5RUFBZ0Q7QUFFaEQsTUFBTSxZQUFZLEdBQUcsc0JBQVcsQ0FBQyxJQUFJLENBQUM7QUFDdEMsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUM7QUFDdEMsTUFBTSxpQkFBaUIsR0FBRyx1QkFBdUIsQ0FBQztBQUNsRCxNQUFNLGdCQUFnQixHQUFHLGNBQWMsQ0FBQztBQUN4QyxNQUFNLGlCQUFpQixHQUFHLGFBQWEsQ0FBQztBQUV4QyxNQUFNLGlCQUFpQixHQUFHO0lBQ3RCLE9BQU8sRUFBRSw4Q0FBOEM7SUFDdkQsR0FBRyxFQUFFLGNBQWM7SUFDbkIsS0FBSyxFQUFFLG1CQUFtQjtJQUMxQixJQUFJLEVBQUUsUUFBUTtJQUNkLFFBQVEsRUFBRSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7SUFDMUIsVUFBVSxFQUFFO1FBQ1IsR0FBRyxFQUFFO1lBQ0QsSUFBSSxFQUFFLFFBQVE7WUFDZCxLQUFLLEVBQUUsTUFBTTtTQUNoQjtRQUNELEtBQUssRUFBRTtZQUNILElBQUksRUFBRSxPQUFPO1lBQ2IsS0FBSyxFQUFFLE1BQU07WUFDYixLQUFLLEVBQUU7Z0JBQ0gsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsS0FBSyxFQUFFLE1BQU07Z0JBQ2IsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNwQixVQUFVLEVBQUU7b0JBQ1IsTUFBTSxFQUFFO3dCQUNKLElBQUksRUFBRSxRQUFRO3dCQUNkLEtBQUssRUFBRSxRQUFRO3FCQUNsQjtvQkFDRCxLQUFLLEVBQUU7d0JBQ0gsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsS0FBSyxFQUFFLFVBQVU7cUJBQ3BCO29CQUNELFdBQVcsRUFBRTt3QkFDVCxJQUFJLEVBQUUsUUFBUTt3QkFD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b0JBQzNCLE9BQU87Z0JBQ1gsQ0FBQztnQkFDRCxJQUFJLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztvQkFDdEIsS0FBSyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFFRixJQUFZLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztRQUN0QyxDQUFDO1FBQ0QsS0FBSyxDQUFDLFlBQVk7WUFDZCxNQUFNLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN2QixNQUFNLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQ2pDLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3hCLENBQUM7UUFDRCxLQUFLLENBQUMsZUFBZTtZQUNqQixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEIsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDOUIsQ0FBQztLQUNKO0lBQ0QsS0FBSztRQUNELEtBQUssSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFDRCxXQUFXLEtBQUksQ0FBQztJQUNoQixLQUFLLEtBQUksQ0FBQztDQUNiLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVuc3VyZURpciwgbW92ZSwgcGF0aEV4aXN0cywgcmVhZEZpbGVTeW5jLCByZWFkZGlyLCByZW1vdmUsIHdyaXRlSnNvbiB9IGZyb20gJ2ZzLWV4dHJhJztcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vLi4vLi4vcGFja2FnZS5qc29uJztcclxuXHJcbmNvbnN0IFBBQ0tBR0VfTkFNRSA9IHBhY2thZ2VKU09OLm5hbWU7XHJcbmNvbnN0IFBST0ZJTEVfS0VZID0gJ2d1aWRlUGFuZWxTdGF0ZSc7XHJcbmNvbnN0IFJFU09VUkNFU19EQl9ST09UID0gJ2RiOi8vYXNzZXRzL3Jlc291cmNlcyc7XHJcbmNvbnN0IFNDSEVNQV9GSUxFX05BTUUgPSAnLnNjaGVtYS5qc29uJztcclxuY29uc3QgR1VJREVfRklMRV9TVUZGSVggPSAnLmd1aWRlLmpzb24nO1xyXG5cclxuY29uc3QgR1VJREVfVEFTS19TQ0hFTUEgPSB7XHJcbiAgICAkc2NoZW1hOiAnaHR0cHM6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQvMjAyMC0xMi9zY2hlbWEnLFxyXG4gICAgJGlkOiAnLnNjaGVtYS5qc29uJyxcclxuICAgIHRpdGxlOiAnZ3VpZGUgdGFzayBzY2hlbWEnLFxyXG4gICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICByZXF1aXJlZDogWydrZXknLCAnc3RlcHMnXSxcclxuICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICBrZXk6IHtcclxuICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgIHRpdGxlOiAn5Lu75Yqh5qCH6K+GJyxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHN0ZXBzOiB7XHJcbiAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgIHRpdGxlOiAn5q2l6aqk5YiX6KGoJyxcclxuICAgICAgICAgICAgaXRlbXM6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgdGl0bGU6ICfmraXpqqTlr7nosaEnLFxyXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndGFyZ2V0J10sXHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ+ebruagh+iKgueCuei3r+W+hCcsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB0aXRsZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICfmraXpqqTmoIfpopjvvIjlj6/pgInvvIknLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5q2l6aqk5o+P6L+w77yI5Y+v6YCJ77yJJyxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50RGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICfmraXpqqTkuovku7bmlbDmja7vvIjlj6/pgInvvIknLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG59O1xyXG5cclxudHlwZSBHdWlkZVBhbmVsU3RhdGUgPSB7XHJcbiAgICByZXNvdXJjZURpcjogc3RyaW5nO1xyXG59O1xyXG5cclxudHlwZSBDb25maXJtTW9kZSA9ICdhZGQnIHwgJ3RyYW5zZmVyJztcclxuXHJcbnR5cGUgR3VpZGVGaWxlRW50cnkgPSB7XHJcbiAgICBkaXNwbGF5TmFtZTogc3RyaW5nO1xyXG4gICAgZmlsZU5hbWU6IHN0cmluZztcclxuICAgIGZ1bGxQYXRoOiBzdHJpbmc7XHJcbiAgICBkYlBhdGg6IHN0cmluZztcclxufTtcclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB2YWx1ZS50cmltKCkucmVwbGFjZSgvXltcXFxcL10rfFtcXFxcL10rJC9nLCAnJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJlc291cmNlc0ZzUm9vdCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGpvaW4oRWRpdG9yLlByb2plY3QucGF0aCwgJ2Fzc2V0cycsICdyZXNvdXJjZXMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gdG9SZXNvdXJjZURiUGF0aChyZWxhdGl2ZURpcjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZWQgPyBgJHtSRVNPVVJDRVNfREJfUk9PVH0vJHtub3JtYWxpemVkfWAgOiBSRVNPVVJDRVNfREJfUk9PVDtcclxufVxyXG5cclxuZnVuY3Rpb24gdG9SZXNvdXJjZUZzUGF0aChyZWxhdGl2ZURpcjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVEaXIocmVsYXRpdmVEaXIpO1xyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZWQgPyBqb2luKGdldFJlc291cmNlc0ZzUm9vdCgpLCBub3JtYWxpemVkKSA6IGdldFJlc291cmNlc0ZzUm9vdCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVHdWlkZU5hbWUodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdmFsdWUudHJpbSgpLnJlcGxhY2UoL1xcLmd1aWRlXFwuanNvbiQvaSwgJycpLnJlcGxhY2UoL1tcXFxcL10rL2csICcnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZXNjYXBlSHRtbCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcbiAgICAgICAgLnJlcGxhY2UoLzwvZywgJyZsdDsnKVxyXG4gICAgICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcclxuICAgICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcbiAgICAgICAgLnJlcGxhY2UoLycvZywgJyYjMzk7Jyk7XHJcbn1cclxuLyoqXHJcbiAqIEB6aCDlpoLmnpzluIzmnJvlhbzlrrkgMy4zIOS5i+WJjeeahOeJiOacrOWPr+S7peS9v+eUqOS4i+aWueeahOS7o+eggVxyXG4gKiBAZW4gWW91IGNhbiBhZGQgdGhlIGNvZGUgYmVsb3cgaWYgeW91IHdhbnQgY29tcGF0aWJpbGl0eSB3aXRoIHZlcnNpb25zIHByaW9yIHRvIDMuM1xyXG4gKi9cclxuLy8gRWRpdG9yLlBhbmVsLmRlZmluZSA9IEVkaXRvci5QYW5lbC5kZWZpbmUgfHwgZnVuY3Rpb24ob3B0aW9uczogYW55KSB7IHJldHVybiBvcHRpb25zIH1cclxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3IuUGFuZWwuZGVmaW5lKHtcclxuICAgIGxpc3RlbmVyczoge1xyXG4gICAgICAgIHNob3coKSB7XHJcbiAgICAgICAgICAgIHZvaWQgdGhpcy5yZWZyZXNoUGFuZWwoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhpZGUoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdoaWRlJyk7XHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL2d1aWRlL2luZGV4Lmh0bWwnKSwgJ3V0Zi04JyksXHJcbiAgICBzdHlsZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3N0eWxlL2d1aWRlL2luZGV4LmNzcycpLCAndXRmLTgnKSxcclxuICAgICQ6IHtcclxuICAgICAgICByZXNvdXJjZURpcklucHV0OiAnI3Jlc291cmNlRGlySW5wdXQnLFxyXG4gICAgICAgIGNvbmZpcm1SZXNvdXJjZURpckJ0bjogJyNjb25maXJtUmVzb3VyY2VEaXJCdG4nLFxyXG4gICAgICAgIGd1aWRlVGFibGVCb2R5OiAnI2d1aWRlVGFibGVCb2R5JyxcclxuICAgICAgICBuZXdHdWlkZUlucHV0OiAnI25ld0d1aWRlSW5wdXQnLFxyXG4gICAgICAgIGFkZEd1aWRlQnRuOiAnI2FkZEd1aWRlQnRuJyxcclxuICAgIH0sXHJcbiAgICBtZXRob2RzOiB7XHJcbiAgICAgICAgZ2V0RGVmYXVsdFN0YXRlKCk6IEd1aWRlUGFuZWxTdGF0ZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICByZXNvdXJjZURpcjogJycsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRTdGF0ZSgpOiBHdWlkZVBhbmVsU3RhdGUge1xyXG4gICAgICAgICAgICByZXR1cm4gKCh0aGlzIGFzIGFueSkuX3N0YXRlIGFzIEd1aWRlUGFuZWxTdGF0ZSkgfHwgdGhpcy5nZXREZWZhdWx0U3RhdGUoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5vcm1hbGl6ZVN0YXRlKHN0YXRlOiBQYXJ0aWFsPEd1aWRlUGFuZWxTdGF0ZT4gfCBudWxsIHwgdW5kZWZpbmVkKTogR3VpZGVQYW5lbFN0YXRlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHJlc291cmNlRGlyOiBub3JtYWxpemVEaXIoc3RhdGU/LnJlc291cmNlRGlyIHx8ICcnKSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldEd1aWRlRW50cmllcygpOiBHdWlkZUZpbGVFbnRyeVtdIHtcclxuICAgICAgICAgICAgcmV0dXJuICgodGhpcyBhcyBhbnkpLl9ndWlkZUVudHJpZXMgYXMgR3VpZGVGaWxlRW50cnlbXSkgfHwgW107XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBsb2FkU3RhdGUoKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZSA9IGF3YWl0IEVkaXRvci5Qcm9maWxlLmdldFByb2plY3QoUEFDS0FHRV9OQU1FLCBQUk9GSUxFX0tFWSk7XHJcbiAgICAgICAgICAgICAgICAodGhpcyBhcyBhbnkpLl9zdGF0ZSA9IHRoaXMubm9ybWFsaXplU3RhdGUoc3RhdGUgYXMgUGFydGlhbDxHdWlkZVBhbmVsU3RhdGU+KTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSBGYWlsZWQgdG8gbG9hZCBwcm9maWxlIHN0YXRlOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX3N0YXRlID0gdGhpcy5nZXREZWZhdWx0U3RhdGUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2F2ZVN0YXRlKHN0YXRlOiBHdWlkZVBhbmVsU3RhdGUpIHtcclxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFN0YXRlID0gdGhpcy5ub3JtYWxpemVTdGF0ZShzdGF0ZSk7XHJcbiAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX3N0YXRlID0gbm9ybWFsaXplZFN0YXRlO1xyXG4gICAgICAgICAgICB2b2lkIEVkaXRvci5Qcm9maWxlLnNldFByb2plY3QoUEFDS0FHRV9OQU1FLCBQUk9GSUxFX0tFWSwgbm9ybWFsaXplZFN0YXRlLCAncHJvamVjdCcpLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIEZhaWxlZCB0byBzYXZlIHByb2ZpbGUgc3RhdGU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldFJlc291cmNlRGlySW5wdXRWYWx1ZSgpOiBzdHJpbmcge1xyXG4gICAgICAgICAgICBjb25zdCBpbnB1dCA9IHRoaXMuJC5yZXNvdXJjZURpcklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICByZXR1cm4gbm9ybWFsaXplRGlyKGlucHV0Py52YWx1ZSB8fCAnJyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBleGlzdHNJblJlc291cmNlc0RiKHJlbGF0aXZlRGlyOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XHJcbiAgICAgICAgICAgIGlmICghbm9ybWFsaXplZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB0b1Jlc291cmNlRGJQYXRoKG5vcm1hbGl6ZWQpKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBCb29sZWFuKGluZm8pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIGFzc2V0LWRiIHF1ZXJ5IGZhaWxlZCwgZmFsbGJhY2sgdG8gZnMgZXhpc3RzOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoRXhpc3RzKHRvUmVzb3VyY2VGc1BhdGgobm9ybWFsaXplZCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyByZWZyZXNoUmVzb3VyY2VzQXNzZXREYigpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCBSRVNPVVJDRVNfREJfUk9PVCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5ndWlkZV0gYXNzZXQtZGIgcmVmcmVzaCBmYWlsZWQ6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBlbnN1cmVSZXNvdXJjZURpckNyZWF0ZWQocmVsYXRpdmVEaXI6IHN0cmluZykge1xyXG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplRGlyKHJlbGF0aXZlRGlyKTtcclxuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlc0ZzUm9vdCA9IGdldFJlc291cmNlc0ZzUm9vdCgpO1xyXG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZXNFeGlzdHMgPSBhd2FpdCBwYXRoRXhpc3RzKHJlc291cmNlc0ZzUm9vdCk7XHJcbiAgICAgICAgICAgIGlmICghcmVzb3VyY2VzRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBlbnN1cmVEaXIocmVzb3VyY2VzRnNSb290KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYXdhaXQgZW5zdXJlRGlyKHRvUmVzb3VyY2VGc1BhdGgobm9ybWFsaXplZCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgdHJhbnNmZXJSZXNvdXJjZURpcihvbGREaXI6IHN0cmluZywgbmV3RGlyOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgY29uc3Qgb2xkTm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihvbGREaXIpO1xyXG4gICAgICAgICAgICBjb25zdCBuZXdOb3JtYWxpemVkID0gbm9ybWFsaXplRGlyKG5ld0Rpcik7XHJcblxyXG4gICAgICAgICAgICBpZiAoIW9sZE5vcm1hbGl6ZWQgfHwgIW5ld05vcm1hbGl6ZWQgfHwgb2xkTm9ybWFsaXplZCA9PT0gbmV3Tm9ybWFsaXplZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gdG9SZXNvdXJjZUZzUGF0aChvbGROb3JtYWxpemVkKTtcclxuICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHRvUmVzb3VyY2VGc1BhdGgobmV3Tm9ybWFsaXplZCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBvbGRFeGlzdHMgPSBhd2FpdCBwYXRoRXhpc3RzKG9sZFBhdGgpO1xyXG4gICAgICAgICAgICBpZiAoIW9sZEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDljp/nm67lvZXkuI3lrZjlnKg6ICR7b2xkUGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgbmV3RXhpc3RzID0gYXdhaXQgcGF0aEV4aXN0cyhuZXdQYXRoKTtcclxuICAgICAgICAgICAgaWYgKG5ld0V4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDnm67moIfnm67lvZXlt7LlrZjlnKg6ICR7bmV3UGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYXdhaXQgbW92ZShvbGRQYXRoLCBuZXdQYXRoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGVuc3VyZUd1aWRlU2NoZW1hKHJlbGF0aXZlRGlyOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZURpcihyZWxhdGl2ZURpcik7XHJcbiAgICAgICAgICAgIGlmICghbm9ybWFsaXplZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkaXJQYXRoID0gdG9SZXNvdXJjZUZzUGF0aChub3JtYWxpemVkKTtcclxuICAgICAgICAgICAgYXdhaXQgZW5zdXJlRGlyKGRpclBhdGgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgc2NoZW1hUGF0aCA9IGpvaW4oZGlyUGF0aCwgU0NIRU1BX0ZJTEVfTkFNRSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNjaGVtYUV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMoc2NoZW1hUGF0aCk7XHJcbiAgICAgICAgICAgIGlmIChzY2hlbWFFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgYXdhaXQgd3JpdGVKc29uKHNjaGVtYVBhdGgsIEdVSURFX1RBU0tfU0NIRU1BLCB7IHNwYWNlczogMiB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGxpc3RHdWlkZUVudHJpZXMocmVsYXRpdmVEaXI6IHN0cmluZyk6IFByb21pc2U8R3VpZGVGaWxlRW50cnlbXT4ge1xyXG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplRGlyKHJlbGF0aXZlRGlyKTtcclxuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGRpclBhdGggPSB0b1Jlc291cmNlRnNQYXRoKG5vcm1hbGl6ZWQpO1xyXG4gICAgICAgICAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBwYXRoRXhpc3RzKGRpclBhdGgpO1xyXG4gICAgICAgICAgICBpZiAoIWV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBmaWxlTmFtZXMgPSAoYXdhaXQgcmVhZGRpcihkaXJQYXRoKSlcclxuICAgICAgICAgICAgICAgIC5maWx0ZXIoKGZpbGVOYW1lKSA9PiBmaWxlTmFtZS5lbmRzV2l0aChHVUlERV9GSUxFX1NVRkZJWCkpXHJcbiAgICAgICAgICAgICAgICAuc29ydCgobGVmdCwgcmlnaHQpID0+IGxlZnQubG9jYWxlQ29tcGFyZShyaWdodCwgJ3poLUNOJykpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGZpbGVOYW1lcy5tYXAoKGZpbGVOYW1lKSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IGZpbGVOYW1lLnJlcGxhY2UoL1xcLmd1aWRlXFwuanNvbiQvaSwgJycpLFxyXG4gICAgICAgICAgICAgICAgZmlsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICBmdWxsUGF0aDogam9pbihkaXJQYXRoLCBmaWxlTmFtZSksXHJcbiAgICAgICAgICAgICAgICBkYlBhdGg6IGAke3RvUmVzb3VyY2VEYlBhdGgobm9ybWFsaXplZCl9LyR7ZmlsZU5hbWV9YCxcclxuICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgcmVmcmVzaEd1aWRlRW50cmllcygpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VEaXIgPSB0aGlzLmdldFN0YXRlKCkucmVzb3VyY2VEaXI7XHJcbiAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX2d1aWRlRW50cmllcyA9IGF3YWl0IHRoaXMubGlzdEd1aWRlRW50cmllcyhyZXNvdXJjZURpcik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyB1cGRhdGVDb25maXJtQnV0dG9uTW9kZSgpIHtcclxuICAgICAgICAgICAgY29uc3QgYnV0dG9uID0gdGhpcy4kLmNvbmZpcm1SZXNvdXJjZURpckJ0biBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XHJcbiAgICAgICAgICAgIGlmICghYnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50RGlyID0gbm9ybWFsaXplRGlyKHN0YXRlLnJlc291cmNlRGlyKTtcclxuICAgICAgICAgICAgY29uc3QgaW5wdXREaXIgPSB0aGlzLmdldFJlc291cmNlRGlySW5wdXRWYWx1ZSgpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50RXhpc3RzID0gY3VycmVudERpciA/IGF3YWl0IHRoaXMuZXhpc3RzSW5SZXNvdXJjZXNEYihjdXJyZW50RGlyKSA6IGZhbHNlO1xyXG4gICAgICAgICAgICBjb25zdCBpbnB1dEV4aXN0cyA9IGlucHV0RGlyID8gYXdhaXQgdGhpcy5leGlzdHNJblJlc291cmNlc0RiKGlucHV0RGlyKSA6IGZhbHNlO1xyXG4gICAgICAgICAgICBjb25zdCBtb2RlOiBDb25maXJtTW9kZSA9IGlucHV0RGlyICYmIChpbnB1dEV4aXN0cyB8fCAoY3VycmVudEV4aXN0cyAmJiBpbnB1dERpciAhPT0gY3VycmVudERpcikpID8gJ3RyYW5zZmVyJyA6ICdhZGQnO1xyXG5cclxuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fY29uZmlybU1vZGUgPSBtb2RlO1xyXG4gICAgICAgICAgICBidXR0b24udGV4dENvbnRlbnQgPSBtb2RlID09PSAndHJhbnNmZXInID8gJ+i9rOenuycgOiAn5re75YqgJztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIHJlbmRlcigpIHtcclxuICAgICAgICAgICAgY29uc3QgaW5wdXQgPSB0aGlzLiQucmVzb3VyY2VEaXJJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgY29uc3QgbmV3R3VpZGVJbnB1dCA9IHRoaXMuJC5uZXdHdWlkZUlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0U3RhdGUoKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChpbnB1dCkge1xyXG4gICAgICAgICAgICAgICAgaW5wdXQudmFsdWUgPSBzdGF0ZS5yZXNvdXJjZURpcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAobmV3R3VpZGVJbnB1dCkge1xyXG4gICAgICAgICAgICAgICAgbmV3R3VpZGVJbnB1dC52YWx1ZSA9ICcnO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJlbmRlckd1aWRlVGFibGUodGhpcy5nZXRHdWlkZUVudHJpZXMoKSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMudXBkYXRlQ29uZmlybUJ1dHRvbk1vZGUoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlbmRlckd1aWRlVGFibGUoZW50cmllczogR3VpZGVGaWxlRW50cnlbXSkge1xyXG4gICAgICAgICAgICBjb25zdCB0YWJsZUJvZHkgPSB0aGlzLiQuZ3VpZGVUYWJsZUJvZHkgYXMgSFRNTFRhYmxlU2VjdGlvbkVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIXRhYmxlQm9keSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICB0YWJsZUJvZHkuaW5uZXJIVE1MID0gJzx0cj48dGQgY29sc3Bhbj1cIjNcIiBjbGFzcz1cImVtcHR5LXRpcFwiPuaaguaXoOW8leWvvOaWh+S7tu+8jOivt+WcqOS4i+aWueaWsOWinuOAgjwvdGQ+PC90cj4nO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0YWJsZUJvZHkuaW5uZXJIVE1MID0gZW50cmllc1xyXG4gICAgICAgICAgICAgICAgLm1hcChcclxuICAgICAgICAgICAgICAgICAgICAoZW50cnksIGluZGV4KSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHRpdGxlPVwiJHtlc2NhcGVIdG1sKGVudHJ5LmZpbGVOYW1lKX1cIj4ke2VzY2FwZUh0bWwoZW50cnkuZGlzcGxheU5hbWUpfTwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PGJ1dHRvbiBjbGFzcz1cInRhYmxlLWFjdGlvbi1idG5cIiB0eXBlPVwiYnV0dG9uXCIgZGF0YS1hY3Rpb249XCJvcGVuXCIgZGF0YS1pbmRleD1cIiR7aW5kZXh9XCI+5omT5byAPC9idXR0b24+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48YnV0dG9uIGNsYXNzPVwidGFibGUtYWN0aW9uLWJ0biB0YWJsZS1hY3Rpb24tYnRuLWRhbmdlclwiIHR5cGU9XCJidXR0b25cIiBkYXRhLWFjdGlvbj1cImRlbGV0ZVwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiPuWIoOmZpDwvYnV0dG9uPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+YCxcclxuICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgIC5qb2luKCcnKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGhhbmRsZUNvbmZpcm1SZXNvdXJjZURpcigpIHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGlyID0gdGhpcy5nZXRSZXNvdXJjZURpcklucHV0VmFsdWUoKTtcclxuICAgICAgICAgICAgaWYgKCF0YXJnZXREaXIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSDor7flhYjovpPlhaXlvJXlr7zotYTmupDnm67lvZXjgIInKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREaXIgPSBub3JtYWxpemVEaXIoc3RhdGUucmVzb3VyY2VEaXIpO1xyXG4gICAgICAgICAgICBjb25zdCBtb2RlOiBDb25maXJtTW9kZSA9ICgodGhpcyBhcyBhbnkpLl9jb25maXJtTW9kZSBhcyBDb25maXJtTW9kZSkgfHwgJ2FkZCc7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldEV4aXN0cyA9IGF3YWl0IHRoaXMuZXhpc3RzSW5SZXNvdXJjZXNEYih0YXJnZXREaXIpO1xyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmIChtb2RlID09PSAndHJhbnNmZXInKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldEV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSDlt7LliIfmjaLliLDnjrDmnInnm67lvZU6ICR7dG9SZXNvdXJjZURiUGF0aCh0YXJnZXREaXIpfWApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY3VycmVudERpciAmJiBjdXJyZW50RGlyICE9PSB0YXJnZXREaXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy50cmFuc2ZlclJlc291cmNlRGlyKGN1cnJlbnREaXIsIHRhcmdldERpcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIOW3suWwhuebruW9leS7jiAke2N1cnJlbnREaXJ9IOi9rOenu+S4uiAke3RhcmdldERpcn1gKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVJlc291cmNlRGlyQ3JlYXRlZCh0YXJnZXREaXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVSZXNvdXJjZURpckNyZWF0ZWQodGFyZ2V0RGlyKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSDlt7Lmt7vliqDnm67lvZU6ICR7dG9SZXNvdXJjZURiUGF0aCh0YXJnZXREaXIpfWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlR3VpZGVTY2hlbWEodGFyZ2V0RGlyKTtcclxuICAgICAgICAgICAgICAgIHN0YXRlLnJlc291cmNlRGlyID0gdGFyZ2V0RGlyO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zYXZlU3RhdGUoc3RhdGUpO1xyXG5cclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFJlc291cmNlc0Fzc2V0RGIoKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaEd1aWRlRW50cmllcygpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSDorr7nva7nm67lvZXlpLHotKU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhc3luYyBoYW5kbGVBZGRHdWlkZSgpIHtcclxuICAgICAgICAgICAgY29uc3QgbmV3R3VpZGVJbnB1dCA9IHRoaXMuJC5uZXdHdWlkZUlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBpZiAoIW5ld0d1aWRlSW5wdXQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VEaXIgPSB0aGlzLmdldFN0YXRlKCkucmVzb3VyY2VEaXIgfHwgdGhpcy5nZXRSZXNvdXJjZURpcklucHV0VmFsdWUoKTtcclxuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZURpcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIOivt+WFiOmFjee9ruW8leWvvOi1hOa6kOebruW9leOAgicpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBndWlkZU5hbWUgPSBub3JtYWxpemVHdWlkZU5hbWUobmV3R3VpZGVJbnB1dC52YWx1ZSB8fCAnJyk7XHJcbiAgICAgICAgICAgIGlmICghZ3VpZGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVJlc291cmNlRGlyQ3JlYXRlZChyZXNvdXJjZURpcik7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZUd1aWRlU2NoZW1hKHJlc291cmNlRGlyKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IGAke2d1aWRlTmFtZX0ke0dVSURFX0ZJTEVfU1VGRklYfWA7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGpvaW4odG9SZXNvdXJjZUZzUGF0aChyZXNvdXJjZURpciksIGZpbGVOYW1lKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IHBhdGhFeGlzdHMoZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSDlvJXlr7zmlofku7blt7LlrZjlnKg6ICR7ZmlsZU5hbWV9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGF3YWl0IHdyaXRlSnNvbihmaWxlUGF0aCwge1xyXG4gICAgICAgICAgICAgICAgICAgICRzY2hlbWE6IFNDSEVNQV9GSUxFX05BTUUsXHJcbiAgICAgICAgICAgICAgICAgICAga2V5OiBndWlkZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgc3RlcHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfSwgeyBzcGFjZXM6IDIgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoUmVzb3VyY2VzQXNzZXREYigpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoR3VpZGVFbnRyaWVzKCk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIOaWsOWinuW8leWvvOaWh+S7tuWksei0pTonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIG9wZW5HdWlkZShpbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5nZXRHdWlkZUVudHJpZXMoKVtpbmRleF07XHJcbiAgICAgICAgICAgIGlmICghZW50cnkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCBlbnRyeS5kYlBhdGgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIGFzc2V0LWRiIG9wZW4gZmFpbGVkLCBmYWxsYmFjayB0byBzaGVsbDonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVjdHJvbiA9IHJlcXVpcmUoJ2VsZWN0cm9uJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoZWxlY3Ryb24/LnNoZWxsPy5vcGVuUGF0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZWN0cm9uLnNoZWxsLm9wZW5QYXRoKGVudHJ5LmZ1bGxQYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1ticmllZi10b29sa2l0LXBsdWdpbi5ndWlkZV0gRWxlY3Ryb24gc2hlbGwgdW5hdmFpbGFibGU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoKEVkaXRvciBhcyBhbnkpLlNoZWxsPy5vcGVuUGF0aCkge1xyXG4gICAgICAgICAgICAgICAgKEVkaXRvciBhcyBhbnkpLlNoZWxsLm9wZW5QYXRoKGVudHJ5LmZ1bGxQYXRoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbYnJpZWYtdG9vbGtpdC1wbHVnaW4uZ3VpZGVdIOaXoOazleaJk+W8gOaWh+S7tjogJHtlbnRyeS5mdWxsUGF0aH1gKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIHJlbW92ZUd1aWRlKGluZGV4OiBudW1iZXIpIHtcclxuICAgICAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmdldEd1aWRlRW50cmllcygpW2luZGV4XTtcclxuICAgICAgICAgICAgaWYgKCFlbnRyeSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLkRpYWxvZy53YXJuKGDnoa7orqTliKDpmaTlvJXlr7zmlofku7YgJHtlbnRyeS5maWxlTmFtZX0g5ZCX77yfYCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAn5Yig6Zmk56Gu6K6kJyxcclxuICAgICAgICAgICAgICAgICAgICBidXR0b25zOiBbJ+WPlua2iCcsICfliKDpmaQnXSxcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbmNlbDogMCxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghcmVzdWx0IHx8IHJlc3VsdC5yZXNwb25zZSAhPT0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW2JyaWVmLXRvb2xraXQtcGx1Z2luLmd1aWRlXSDliKDpmaTnoa7orqTlvLnnqpfosIPnlKjlpLHotKU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBhd2FpdCByZW1vdmUoZW50cnkuZnVsbFBhdGgpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlZnJlc2hSZXNvdXJjZXNBc3NldERiKCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaEd1aWRlRW50cmllcygpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYmluZEV2ZW50cygpIHtcclxuICAgICAgICAgICAgaWYgKCh0aGlzIGFzIGFueSkuX2V2ZW50c0JvdW5kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpcm1CdG4gPSB0aGlzLiQuY29uZmlybVJlc291cmNlRGlyQnRuIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgY29uc3QgaW5wdXQgPSB0aGlzLiQucmVzb3VyY2VEaXJJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcclxuICAgICAgICAgICAgY29uc3QgYWRkR3VpZGVCdG4gPSB0aGlzLiQuYWRkR3VpZGVCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xyXG4gICAgICAgICAgICBjb25zdCBuZXdHdWlkZUlucHV0ID0gdGhpcy4kLm5ld0d1aWRlSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnN0IGd1aWRlVGFibGVCb2R5ID0gdGhpcy4kLmd1aWRlVGFibGVCb2R5IGFzIEhUTUxUYWJsZVNlY3Rpb25FbGVtZW50IHwgbnVsbDtcclxuXHJcbiAgICAgICAgICAgIGNvbmZpcm1CdG4/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdm9pZCB0aGlzLmhhbmRsZUNvbmZpcm1SZXNvdXJjZURpcigpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGFkZEd1aWRlQnRuPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5oYW5kbGVBZGRHdWlkZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGlucHV0Py5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHZvaWQgdGhpcy51cGRhdGVDb25maXJtQnV0dG9uTW9kZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGlucHV0Py5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdm9pZCB0aGlzLnVwZGF0ZUNvbmZpcm1CdXR0b25Nb2RlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgaW5wdXQ/LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIHtcclxuICAgICAgICAgICAgICAgICAgICB2b2lkIHRoaXMuaGFuZGxlQ29uZmlybVJlc291cmNlRGlyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgbmV3R3VpZGVJbnB1dD8uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5oYW5kbGVBZGRHdWlkZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGd1aWRlVGFibGVCb2R5Py5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudDogRXZlbnQpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBidXR0b24gPSB0YXJnZXQ/LmNsb3Nlc3QoJ2J1dHRvbltkYXRhLWFjdGlvbl1bZGF0YS1pbmRleF0nKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWJ1dHRvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBhY3Rpb24gPSBidXR0b24uZGF0YXNldC5hY3Rpb247XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IE51bWJlcihidXR0b24uZGF0YXNldC5pbmRleCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoTnVtYmVyLmlzTmFOKGluZGV4KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnb3BlbicpIHtcclxuICAgICAgICAgICAgICAgICAgICB2b2lkIHRoaXMub3Blbkd1aWRlKGluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnZGVsZXRlJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZvaWQgdGhpcy5yZW1vdmVHdWlkZShpbmRleCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fZXZlbnRzQm91bmQgPSB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXN5bmMgcmVmcmVzaFBhbmVsKCkge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRTdGF0ZSgpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlZnJlc2hHdWlkZUVudHJpZXMoKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFzeW5jIGluaXRpYWxpemVQYW5lbCgpIHtcclxuICAgICAgICAgICAgdGhpcy5iaW5kRXZlbnRzKCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVmcmVzaFBhbmVsKCk7XHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICByZWFkeSgpIHtcclxuICAgICAgICB2b2lkIHRoaXMuaW5pdGlhbGl6ZVBhbmVsKCk7XHJcbiAgICB9LFxyXG4gICAgYmVmb3JlQ2xvc2UoKSB7fSxcclxuICAgIGNsb3NlKCkge30sXHJcbn0pO1xyXG4iXX0=