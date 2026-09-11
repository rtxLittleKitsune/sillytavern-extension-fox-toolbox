/* ═══════════════════════════════════════════════════════════════════════════
   小狐狸的工具箱 / Fox Toolbox — SillyTavern Extension
   Toggle switches to exclude API parameters from the request body.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const MODULE_NAME = 'fox-toolbox';
    const ROOT_ID = 'fox_toolbox_container';

    // ─── Default settings ────────────────────────────────────────────────────
    const DEFAULT_SETTINGS = Object.freeze({
        excludedParams: {}, // { temperature: true, top_k: true, ... }
    });

    // ─── Parameter definitions ────────────────────────────────────────────────
    const PARAM_GROUPS = [
        {
            groupCn: '采样参数',
            groupEn: 'Sampling',
            params: [
                { key: 'temperature',       cn: '温度',       en: 'Temperature',        desc: '控制随机性，越高越随机' },
                { key: 'top_p',              cn: '核采样',     en: 'Top-P',              desc: 'nucleus sampling，限制候选词概率累积' },
                { key: 'top_k',              cn: 'Top-K',      en: 'Top-K',              desc: '限制候选词数量为前 K 个' },
                { key: 'top_a',              cn: 'Top-A',      en: 'Top-A',              desc: '动态裁剪低概率候选词' },
                { key: 'min_p',              cn: 'Min-P',      en: 'Min-P',              desc: '设定最小概率阈值' },
                { key: 'repetition_penalty', cn: '重复惩罚',   en: 'Repetition Penalty', desc: '惩罚已出现 token 的重复' },
            ],
        },
        {
            groupCn: '惩罚参数',
            groupEn: 'Penalties',
            params: [
                { key: 'frequency_penalty', cn: '频率惩罚',   en: 'Frequency Penalty',  desc: '按频率惩罚重复 token' },
                { key: 'presence_penalty',  cn: '存在惩罚',   en: 'Presence Penalty',   desc: '对已出现 token 施加固定惩罚' },
            ],
        },
        {
            groupCn: '其他参数',
            groupEn: 'Other',
            params: [
                { key: 'max_tokens',       cn: '最大生成长度', en: 'Max Tokens',       desc: '限制回复最大 token 数' },
                { key: 'seed',             cn: '随机种子',     en: 'Seed',             desc: '固定生成结果的随机种子' },
                { key: 'reasoning_effort', cn: '推理强度',     en: 'Reasoning Effort', desc: 'o1/o3 系列模型的推理力度' },
                { key: 'logit_bias',       cn: 'Logit 偏置',   en: 'Logit Bias',       desc: '对特定 token 的 logit 偏移' },
                { key: 'stop',             cn: '停止词',       en: 'Stop Strings',     desc: '自定义停止字符串' },
                { key: 'logprobs',         cn: 'Logprobs',     en: 'Logprobs',         desc: '返回每个 token 的对数概率' },
            ],
        },
    ];

    const ALL_PARAMS = PARAM_GROUPS.reduce(function (acc, g) {
        return acc.concat(g.params);
    }, []);

    // ─── Context helper (try/catch + ?. fallback per guide section 三/五) ──────
    function getCtx() {
        try {
            return (typeof SillyTavern !== 'undefined' && SillyTavern.getContext)
                ? SillyTavern.getContext()
                : null;
        } catch (e) {
            console.warn('[Fox Toolbox] getContext failed:', e);
            return null;
        }
    }

    function getEventSource() {
        const ctx = getCtx();
        return (ctx && ctx.eventSource) || (typeof window !== 'undefined' ? window.eventSource : null) || null;
    }

    function getEventTypes() {
        const ctx = getCtx();
        return (ctx && ctx.event_types) || (typeof window !== 'undefined' ? window.event_types : null) || null;
    }

    function getExtensionSettings() {
        const ctx = getCtx();
        return (ctx && ctx.extensionSettings)
            || (typeof window !== 'undefined' ? window.extension_settings : null)
            || null;
    }

    function getSaveSettingsDebounced() {
        const ctx = getCtx();
        return (ctx && ctx.saveSettingsDebounced)
            || (typeof window !== 'undefined' ? window.saveSettingsDebounced : null)
            || null;
    }

    // ─── Settings helpers ────────────────────────────────────────────────────
    function getSettings() {
        const extSettings = getExtensionSettings();
        if (!extSettings) {
            return { excludedParams: {} };
        }

        if (!extSettings[MODULE_NAME]) {
            extSettings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
        }
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (extSettings[MODULE_NAME][key] === undefined) {
                extSettings[MODULE_NAME][key] = structuredClone(DEFAULT_SETTINGS[key]);
            }
        }
        const s = extSettings[MODULE_NAME];
        if (typeof s.excludedParams !== 'object' || s.excludedParams === null || Array.isArray(s.excludedParams)) {
            s.excludedParams = {};
        }
        return s;
    }

    function saveSettings() {
        try {
            const fn = getSaveSettingsDebounced();
            if (typeof fn === 'function') {
                fn.call(null);
            }
        } catch (e) {
            console.warn('[Fox Toolbox] saveSettings failed:', e);
        }
    }

    // ─── Core event handler ──────────────────────────────────────────────────
    // Fires right before generate_data is serialized and sent to the API.
    // Mutates generate_data in-place by deleting excluded keys.
    function onChatCompletionSettingsReady(generate_data) {
        try {
            if (!generate_data || typeof generate_data !== 'object') {
                return;
            }
            const settings = getSettings();
            const excluded = settings.excludedParams;
            for (let i = 0; i < ALL_PARAMS.length; i++) {
                const key = ALL_PARAMS[i].key;
                if (excluded[key] && Object.prototype.hasOwnProperty.call(generate_data, key)) {
                    delete generate_data[key];
                }
            }
        } catch (e) {
            console.warn('[Fox Toolbox] onChatCompletionSettingsReady error:', e);
        }
    }

    // ─── HTML generation (inline string, no Handlebars dependency) ───────────
    function escapeAttr(s) {
        return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function buildPanelHtml() {
        const settings = getSettings();
        const excluded = settings.excludedParams;

        let html = '<div id="' + ROOT_ID + '" class="fox_toolbox">';
        html += '<div class="fox_toolbox_header">';
        html += '<h4>小狐狸的工具箱 <small>Fox Toolbox</small></h4>';
        html += '<p class="fox_toolbox_desc">从请求体中排除参数 — 勾选 = 排除该参数<br>Exclude parameters from the request body — checked = excluded</p>';
        html += '</div>';
        html += '<div class="fox_toolbox_actions">';
        html += '<button id="fox_toolbox_select_all" class="menu_button menu_button_small" type="button"><span>全选 / Select All</span></button>';
        html += '<button id="fox_toolbox_deselect_all" class="menu_button menu_button_small" type="button"><span>全不选 / Deselect All</span></button>';
        html += '</div>';
        html += '<div class="fox_toolbox_groups">';

        for (let gi = 0; gi < PARAM_GROUPS.length; gi++) {
            const group = PARAM_GROUPS[gi];
            html += '<div class="fox_toolbox_group">';
            html += '<div class="fox_toolbox_group_title">' + group.groupCn + ' <small>' + group.groupEn + '</small></div>';
            html += '<div class="fox_toolbox_rows">';

            for (let pi = 0; pi < group.params.length; pi++) {
                const p = group.params[pi];
                const isExcluded = Boolean(excluded[p.key]);
                html += '<label class="fox_toggle_row" title="' + escapeAttr(p.desc) + '">';
                html += '<span class="fox_toggle_switch">';
                html += '<input type="checkbox" name="fox-param-exclude" value="' + escapeAttr(p.key) + '"' + (isExcluded ? ' checked' : '') + '>';
                html += '<span class="fox_toggle_slider"></span>';
                html += '</span>';
                html += '<span class="fox_toggle_label">';
                html += '<span class="fox_toggle_cn">' + p.cn + '</span>';
                html += '<span class="fox_toggle_key">' + p.key + '</span>';
                html += '</span>';
                html += '</label>';
            }

            html += '</div>'; // rows
            html += '</div>'; // group
        }

        html += '</div>'; // groups
        html += '</div>'; // container
        return html;
    }

    function updateToggleStates() {
        const settings = getSettings();
        const excluded = settings.excludedParams;
        const checkboxes = document.querySelectorAll('#' + ROOT_ID + ' input[name="fox-param-exclude"]');
        for (let i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = Boolean(excluded[checkboxes[i].value]);
        }
    }

    function mountUI() {
        if (document.getElementById(ROOT_ID)) {
            return; // already mounted (idempotent)
        }

        const html = buildPanelHtml();

        // Try the standard extension settings container first
        let target = document.getElementById('extensions_settings2')
            || document.getElementById('extensions_settings')
            || document.getElementById('rm_extensions_block');

        if (target) {
            target.insertAdjacentHTML('beforeend', html);
        } else {
            // Fallback: append to the extensions panel directly
            target = document.querySelector('#extensions_panel .inline-drawer-content')
                || document.querySelector('#extensions_settings2')
                || document.querySelector('#extensionsSettings');

            if (target) {
                target.insertAdjacentHTML('beforeend', html);
            } else {
                console.warn('[Fox Toolbox] Could not find extension settings container to mount UI');
            }
        }

        wireEvents();
    }

    function wireEvents() {
        const container = document.getElementById(ROOT_ID);
        if (!container) {
            return;
        }

        // Toggle change events (event delegation)
        container.addEventListener('change', function (event) {
            const target = event.target;
            if (target && target.matches && target.matches('input[name="fox-param-exclude"]')) {
                const key = target.value;
                const settings = getSettings();
                settings.excludedParams[key] = target.checked;
                saveSettings();
            }
        });

        // Select All
        const selectAllBtn = container.querySelector('#fox_toolbox_select_all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function () {
                const settings = getSettings();
                for (let i = 0; i < ALL_PARAMS.length; i++) {
                    settings.excludedParams[ALL_PARAMS[i].key] = true;
                }
                updateToggleStates();
                saveSettings();
            });
        }

        // Deselect All
        const deselectAllBtn = container.querySelector('#fox_toolbox_deselect_all');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', function () {
                const settings = getSettings();
                settings.excludedParams = {};
                updateToggleStates();
                saveSettings();
            });
        }
    }

    function registerEventHandler() {
        const eventSource = getEventSource();
        const event_types = getEventTypes();

        if (!eventSource || !event_types || !event_types.CHAT_COMPLETION_SETTINGS_READY) {
            console.warn('[Fox Toolbox] Could not register event handler — eventSource or event_types unavailable');
            return false;
        }

        eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);
        return true;
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    function init() {
        try {
            // Initialize settings
            getSettings();

            // Mount the UI panel
            mountUI();

            // Register the core event handler
            if (!registerEventHandler()) {
                // Retry once after a delay in case eventSource isn't ready yet
                setTimeout(function () {
                    registerEventHandler();
                }, 2000);
            }

            console.log('[Fox Toolbox] 小狐狸的工具箱 loaded.');
        } catch (e) {
            console.warn('[Fox Toolbox] init error:', e);
        }
    }

    // ─── Bootstrap: APP_READY + polling fallback + idempotent (per guide) ────
    let done = false;
    function fire() {
        if (done) return;
        done = true;
        init();
    }

    const eventSource = getEventSource();
    const event_types = getEventTypes();
    if (eventSource && event_types && event_types.APP_READY) {
        try {
            eventSource.on(event_types.APP_READY, fire);
        } catch (e) {
            console.warn('[Fox Toolbox] Failed to register APP_READY listener:', e);
        }
    }

    // Polling fallback — check for extension_settings availability with 3.5s timeout
    const t0 = Date.now();
    const iv = setInterval(function () {
        const ok = !!(getExtensionSettings() || (typeof window !== 'undefined' && window.SillyTavern));
        if (ok || Date.now() - t0 > 3500) {
            clearInterval(iv);
            fire();
        }
    }, 250);

    // Expose init for the manifest's optional activate hook
    if (typeof window !== 'undefined') {
        window.foxToolboxInit = init;
    }
})();
