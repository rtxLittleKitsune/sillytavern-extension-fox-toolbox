import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../extensions.js';
import { eventSource } from '../../script.js';
import { saveSettingsDebounced } from '../../../script.js';
import { t } from '../../i18n.js';

// ─── Module identity ─────────────────────────────────────────────────────────
const MODULE_NAME = 'fox-toolbox';

// ─── Default settings ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = Object.freeze({
    // Map of paramKey -> boolean (true = exclude from request body)
    excludedParams: {},
});

// ─── Parameter definitions ───────────────────────────────────────────────────
// Each entry: { key, cn, en, desc }
// Grouped by category for display. The `key` is the actual generate_data field.
const PARAM_GROUPS = [
    {
        groupCn: '采样参数',
        groupEn: 'Sampling',
        params: [
            { key: 'temperature',         cn: '温度',           en: 'Temperature',          desc: '控制随机性，越高越随机' },
            { key: 'top_p',                cn: '核采样',         en: 'Top-P',                desc: ' nucleus sampling，限制候选词概率累积' },
            { key: 'top_k',                cn: 'Top-K',          en: 'Top-K',                desc: '限制候选词数量为前 K 个' },
            { key: 'top_a',                cn: 'Top-A',          en: 'Top-A',                desc: '动态裁剪低概率候选词' },
            { key: 'min_p',                cn: 'Min-P',          en: 'Min-P',                desc: '设定最小概率阈值' },
            { key: 'repetition_penalty',   cn: '重复惩罚',       en: 'Repetition Penalty',   desc: '惩罚已出现 token 的重复' },
        ],
    },
    {
        groupCn: '惩罚参数',
        groupEn: 'Penalties',
        params: [
            { key: 'frequency_penalty',   cn: '频率惩罚',       en: 'Frequency Penalty',   desc: '按频率惩罚重复 token' },
            { key: 'presence_penalty',     cn: '存在惩罚',       en: 'Presence Penalty',     desc: '对已出现 token 施加固定惩罚' },
        ],
    },
    {
        groupCn: '其他参数',
        groupEn: 'Other',
        params: [
            { key: 'max_tokens',           cn: '最大生成长度',   en: 'Max Tokens',           desc: '限制回复最大 token 数' },
            { key: 'seed',                 cn: '随机种子',       en: 'Seed',                 desc: '固定生成结果的随机种子' },
            { key: 'reasoning_effort',     cn: '推理强度',       en: 'Reasoning Effort',     desc: 'o1/o3 系列模型的推理力度' },
            { key: 'logit_bias',           cn: 'Logit 偏置',     en: 'Logit Bias',           desc: '对特定 token 的 logit 偏移' },
            { key: 'stop',                 cn: '停止词',         en: 'Stop Strings',         desc: '自定义停止字符串' },
            { key: 'logprobs',             cn: 'Logprobs',       en: 'Logprobs',             desc: '返回每个 token 的对数概率' },
        ],
    },
];

// Flatten for quick lookups
const ALL_PARAMS = PARAM_GROUPS.flatMap(g => g.params);

// ─── Settings helpers ───────────────────────────────────────────────────────
function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    // Ensure all default keys exist
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = structuredClone(DEFAULT_SETTINGS[key]);
        }
    }
    // Ensure excludedParams is an object
    if (typeof extension_settings[MODULE_NAME].excludedParams !== 'object' ||
        extension_settings[MODULE_NAME].excludedParams === null ||
        Array.isArray(extension_settings[MODULE_NAME].excludedParams)) {
        extension_settings[MODULE_NAME].excludedParams = {};
    }
    return extension_settings[MODULE_NAME];
}

// ─── Core event handler ─────────────────────────────────────────────────────
// Fires right before generate_data is serialized and sent to the API.
// Mutates generate_data in-place by deleting excluded keys.
function onChatCompletionSettingsReady(generate_data) {
    if (!generate_data || typeof generate_data !== 'object') {
        return;
    }

    const settings = getSettings();
    const excluded = settings.excludedParams;

    for (const param of ALL_PARAMS) {
        if (excluded[param.key] && Object.prototype.hasOwnProperty.call(generate_data, param.key)) {
            delete generate_data[param.key];
        }
    }
}

// ─── UI rendering ────────────────────────────────────────────────────────────
function buildTemplateData() {
    const settings = getSettings();
    const excluded = settings.excludedParams;

    return {
        groups: PARAM_GROUPS.map(group => ({
            groupCn: group.groupCn,
            groupEn: group.groupEn,
            params: group.params.map(p => ({
                key: p.key,
                cn: p.cn,
                en: p.en,
                desc: p.desc,
                excluded: Boolean(excluded[p.key]),
            })),
        })),
    };
}

function updateToggleStates() {
    const settings = getSettings();
    const excluded = settings.excludedParams;
    const checkboxes = document.querySelectorAll('input[name="fox-param-exclude"]');
    for (const cb of checkboxes) {
        const key = cb.value;
        cb.checked = Boolean(excluded[key]);
    }
}

// ─── Init ────────────────────────────────────────────────────────────────────
export async function init() {
    // Initialize settings
    getSettings();

    // Render the settings panel via Handlebars template
    const templateData = buildTemplateData();
    const html = await renderExtensionTemplateAsync('third-party/fox-toolbox', 'settings', templateData);
    $('#extensions_settings2').append(html);

    // Wire up toggle events — each checkbox toggles exclusion for that param
    const container = document.getElementById('fox_toolbox_container');
    if (container) {
        container.addEventListener('change', function (event) {
            const target = event.target;
            if (target.matches('input[name="fox-param-exclude"]')) {
                const key = target.value;
                const settings = getSettings();
                settings.excludedParams[key] = target.checked;
                saveSettingsDebounced();
            }
        });

        // "Select all" / "Deselect all" buttons
        const selectAllBtn = container.querySelector('#fox_toolbox_select_all');
        const deselectAllBtn = container.querySelector('#fox_toolbox_deselect_all');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function () {
                const settings = getSettings();
                for (const param of ALL_PARAMS) {
                    settings.excludedParams[param.key] = true;
                }
                updateToggleStates();
                saveSettingsDebounced();
            });
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', function () {
                const settings = getSettings();
                settings.excludedParams = {};
                updateToggleStates();
                saveSettingsDebounced();
            });
        }
    }

    // Register the core event handler — this is where the magic happens.
    // CHAT_COMPLETION_SETTINGS_READY fires with the mutable generate_data object
    // right before it's JSON.stringify'd into the fetch body.
    const { event_types } = getContext();
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);

    // Clean up on extension unload (not strictly necessary, but good practice)
    // SillyTavern doesn't have an unload hook, but we register once on init.

    console.log('[Fox Toolbox] 小狐狸的工具箱 loaded. Parameters can be toggled in the extension settings.');
}
