import { loadSettings, saveSettings } from './settings.js';
import { applyI18n, t } from './i18n.js';

const language = document.getElementById('language');
const length = document.getElementById('length');
const type = document.getElementById('type');
const autoRun = document.getElementById('autoRun');
const allSites = document.getElementById('allSites');
const saved = document.getElementById('saved');

// 全サイトの読み取りはオプション権限。チェックの操作でその場で許可／取り消しする。
const HOST_ACCESS = { origins: ['<all_urls>'] };

let savedTimer = null;
function flashSaved() {
  saved.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { saved.hidden = true; }, 1500);
}

/** UI文言を選択中の言語で描き直す */
function render(lang) {
  document.documentElement.lang = lang;
  document.title = t(lang, 'settingsTitle');
  applyI18n(document, lang);
}

const settings = await loadSettings();
language.value = settings.language;
length.value = settings.length;
type.value = settings.type;
autoRun.checked = settings.autoRun;
allSites.checked = await chrome.permissions.contains(HOST_ACCESS).catch(() => false);
render(settings.language);

// 変更即保存（保存ボタンなし）
language.addEventListener('change', async () => {
  await saveSettings({ language: language.value });
  render(language.value);
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
    // granted = 操作後に権限を持っているか。取り消し成功なら false になる。
    const granted = want
      ? await chrome.permissions.request(HOST_ACCESS)
      : !(await chrome.permissions.remove(HOST_ACCESS));
    allSites.checked = granted;
    if (granted === want) flashSaved();
  } catch (err) {
    console.warn('[web-page-summarizer] permissions:', err);
    allSites.checked = !want;
  }
});
