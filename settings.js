// サイドパネルと設定画面で共有する設定の読み書き

export const LANGUAGES = ['en', 'ja', 'zh'];

/** ブラウザのUI言語から要約言語の既定値を決める（対応外は英語） */
export function browserLanguage() {
  const ui = (chrome.i18n?.getUILanguage?.() || navigator.language || 'en').toLowerCase();
  if (ui.startsWith('ja')) return 'ja';
  if (ui.startsWith('zh')) return 'zh'; // zh-CN / zh-TW とも簡体字でまとめる
  return 'en';
}

export const DEFAULTS = {
  length: 'short',    // short | medium | long
  type: 'key-points', // key-points | tldr | teaser | headline
  autoRun: true,      // パネルを開いたら自動で要約する
  // language の既定値はブラウザ言語なので loadSettings() で補完する
};

export async function loadSettings() {
  const defaults = { ...DEFAULTS, language: browserLanguage() };
  const stored = await chrome.storage.sync.get(defaults);
  const settings = { ...defaults, ...stored };
  if (!LANGUAGES.includes(settings.language)) settings.language = browserLanguage();
  return settings;
}

export async function saveSettings(patch) {
  await chrome.storage.sync.set(patch);
}
