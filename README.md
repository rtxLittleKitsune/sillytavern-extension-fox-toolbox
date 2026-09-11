# 🦊 小狐狸的工具箱 / Fox Toolbox

A [SillyTavern](https://github.com/SillyTavern/SillyTavern) extension that lets you **exclude API request parameters** (temperature, top_p, top_k, frequency_penalty, etc.) from the request body — using simple toggle switches instead of typing parameter names into a text box.

## Why?

SillyTavern's connection profiles already let you exclude parameters via a text field (`custom_exclude_body`), but it has limitations:

- You have to **type parameter names manually** (and they must be in YAML format).
- The setting is **tied to the CUSTOM chat completion source** — it doesn't work for OpenAI, Claude, Gemini, OpenRouter, etc.
- When you **switch presets or connection profiles**, the exclude setting can be lost or overwritten.

Fox Toolbox solves this by hooking into SillyTavern's `CHAT_COMPLETION_SETTINGS_READY` event, which fires **before** the request body is sent to the API. It works for **all Chat Completion sources** and stores your toggle state in **extension settings** — so it survives preset and profile switches.

## Features

- ✅ **Toggle switches** for 14 common parameters — no typing required
- ✅ **Works with all Chat Completion APIs** (OpenAI, Claude, Gemini, OpenRouter, Cohere, Mistral, etc.)
- ✅ **Persistent** — settings stored in extension settings, not presets or profiles
- ✅ **Bilingual labels** — Chinese names + English parameter keys
- ✅ **Select All / Deselect All** buttons for convenience
- ✅ **Dark theme compatible** — uses SillyTavern's CSS variables

## Parameters

| Group | Parameter Key | Chinese Label |
|-------|---------------|---------------|
| 采样 Sampling | `temperature` | 温度 |
| 采样 Sampling | `top_p` | 核采样 |
| 采样 Sampling | `top_k` | Top-K |
| 采样 Sampling | `top_a` | Top-A |
| 采样 Sampling | `min_p` | Min-P |
| 采样 Sampling | `repetition_penalty` | 重复惩罚 |
| 惩罚 Penalties | `frequency_penalty` | 频率惩罚 |
| 惩罚 Penalties | `presence_penalty` | 存在惩罚 |
| 其他 Other | `max_tokens` | 最大生成长度 |
| 其他 Other | `seed` | 随机种子 |
| 其他 Other | `reasoning_effort` | 推理强度 |
| 其他 Other | `logit_bias` | Logit 偏置 |
| 其他 Other | `stop` | 停止词 |
| 其他 Other | `logprobs` | Logprobs |

## Installation

### Method 1: Via SillyTavern UI (Recommended)

1. Open SillyTavern.
2. Go to **Extensions** (top bar) → **Manage Extensions**.
3. Click **Install Extension**.
4. Paste this repository's GitHub URL:
   ```
   https://github.com/rtxLittleKitsune/sillytavern-extension-fox-toolbox
   ```
5. Click **Install**.
6. Reload the page (Ctrl+Shift+R). The extension will appear in the Extensions panel.

### Method 2: Manual Clone

1. Clone this repository into your SillyTavern's third-party extensions directory:
   ```
   cd <SillyTavern>/public/scripts/extensions/third-party
   git clone https://github.com/rtxLittleKitsune/sillytavern-extension-fox-toolbox.git
   ```
   Or, for per-user installation, clone into:
   ```
   <SillyTavern>/data/<your-user-handle>/extensions/
   ```
2. Reload SillyTavern (Ctrl+Shift+R).

## Usage

1. Open SillyTavern → **Extensions** panel.
2. Scroll to find **🦊 小狐狸的工具箱 / Fox Toolbox**.
3. Toggle the switches next to any parameters you want to **exclude** from the API request body.
   - Switch ON (red) = **excluded** — the parameter will be removed from the request.
   - Switch OFF (gray) = **included** — the parameter stays in the request (default).
4. Use **全选 / Select All** to exclude everything, or **全不选 / Deselect All** to reset.
5. Your settings are saved automatically and persist across preset/profile switches.

## How It Works

When SillyTavern prepares a Chat Completion request, it assembles a `generate_data` object containing all the parameters (temperature, top_p, etc.). Right before this object is serialized via `JSON.stringify()` and sent to the API, SillyTavern emits the `CHAT_COMPLETION_SETTINGS_READY` event, passing the `generate_data` object by reference.

Fox Toolbox listens to this event and `delete`s any toggled parameter from `generate_data`. The deletions are reflected in the final request body because the object is mutated in place before serialization.

This approach:
- Works for **all Chat Completion sources** (not just CUSTOM).
- Runs on the **client side** — no server plugin needed.
- Doesn't interfere with SillyTavern's own parameter logic (source-specific clamping, deletion, etc.) because it runs **after** those steps.

## Compatibility

- **SillyTavern** — compatible with the latest release branch.
- **Chat Completion APIs only** — OpenAI, Claude, Gemini, OpenRouter, Cohere, Mistral, AI21, Perplexity, ZAI, SiliconFlow, MiniMax, Workers AI, NanoGPT, Moonshot, Chutes, and CUSTOM sources.
- Text Completion APIs (KoboldAI, TextGen WebUI, etc.) are **not** currently supported (they use a separate event `TEXT_COMPLETION_SETTINGS_READY`). This may be added in a future version.

## License

AGPL-3.0 — see [LICENSE](LICENSE).

## Author

Fox

## Contributing

Issues and pull requests are welcome at the [GitHub repository](https://github.com/rtxLittleKitsune/sillytavern-extension-fox-toolbox).
