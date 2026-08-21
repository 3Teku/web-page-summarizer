import { loadSettings, saveSettings, browserLanguage } from './settings.js';

const language = document.getElementById('language');
const languageHint = document.getElementById('languageHint');
const length = document.getElementById('length');
const type = document.getElementById('type');
const autoRun = document.getElementById('autoRun');
const allSites = document.getElementById('allSites');
const saved = document.getElementById('saved');

// 全サイトの読み取りはオプション権限。チェックの操作でその場で許可／取り消しする。
const HOST_ACCESS = { origins: ['<all_urls>'] };

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
allSites.checked = await chrome.permissions.contains(HOST_ACCESS).catch(() => false);

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

// 権限の許可／取り消しは storage ではなく Chrome 側の状態。
// ダイアログで拒否された場合はチェックを元に戻す。
allSites.addEventListener('change', async () => {
  const want = allSites.checked;
  try {
    const ok = want
      ? await chrome.permissions.request(HOST_ACCESS)
      : !(await chrome.permissions.remove(HOST_ACCESS));
    allSites.checked = want ? ok : !ok;
    if (allSites.checked === want) flashSaved();
  } catch (err) {
    console.warn('[web-page-summarizer] permissions:', err);
    allSites.checked = !want;
  }
});
