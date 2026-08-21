import { loadSettings, saveSettings, browserLanguage } from './settings.js';

const language = document.getElementById('language');
const languageHint = document.getElementById('languageHint');
const length = document.getElementById('length');
const type = document.getElementById('type');
const autoRun = document.getElementById('autoRun');
const saved = document.getElementById('saved');

const LANGUAGE_LABELS = { en: 'English', ja: '日本語', zh: '中文（简体）' };

let savedTimer = null;
function flashSaved() {
  saved.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { saved.hidden = true; }, 1500);
}

const settings = await loadSettings();
language.value = settings.language;
length.value = settings.length;
type.value = settings.type;
autoRun.checked = settings.autoRun;

languageHint.textContent =
  `既定はブラウザの言語（${LANGUAGE_LABELS[browserLanguage()]}）です。UIの表示言語ではなく、要約文の言語が変わります。`;

// 変更即保存（保存ボタンなし）
language.addEventListener('change', async () => {
  await saveSettings({ language: language.value });
  flashSaved();
});
length.addEventListener('change', async () => {
  await saveSettings({ length: length.value });
  flashSaved();
});
type.addEventListener('change', async () => {
  await saveSettings({ type: type.value });
  flashSaved();
});
autoRun.addEventListener('change', async () => {
  await saveSettings({ autoRun: autoRun.checked });
  flashSaved();
});
