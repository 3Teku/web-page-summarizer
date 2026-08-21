// ---------------------------------------------------------------------------
// ページ要約サイドパネル
//   1. アクティブタブに抽出スクリプトを注入して本文テキストを取り出す
//   2. Chrome内蔵AI (Summarizer API / Gemini Nano) で要約する
// ---------------------------------------------------------------------------

import { loadSettings } from './settings.js';
import { applyI18n, t } from './i18n.js';

const els = {
  run: document.getElementById('run'),
  runLabel: document.getElementById('runLabel'),
  openOptions: document.getElementById('openOptions'),
  state: document.getElementById('state'),
  stateMsg: document.getElementById('stateMsg'),
  progress: document.getElementById('progress'),
  progressBar: document.getElementById('progressBar'),
  progressLabel: document.getElementById('progressLabel'),
  result: document.getElementById('result'),
  pageMeta: document.getElementById('pageMeta'),
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
};

// Chrome 138+ は self.Summarizer。Origin Trial 期は self.ai.summarizer。
const SummarizerAPI = self.Summarizer ?? self.ai?.summarizer ?? null;

// 要約の文体指示（言語別）。sharedContext / context の両方に渡してブレを抑える。
const SUMMARY_STYLE = {
  ja: [
    'Webページの本文です。日本語で要約してください。',
    '文体のルール:',
    '- 各項目は体言止め（名詞で終わる形）にする',
    '- 「です」「ます」「である」などの述語で終えない',
    '- 主語は必ず書く。「誰が」「何を」を省略しない',
    '- 「そのため」「一方で」などの接続詞も省略せず、項目間のつながりを示す',
    '- 前置き・感想・「この記事は」などの説明を書かない',
    '例: 「新機能を追加したため、処理速度が向上しました。」',
    '  →「同社が新機能を追加したことによる、処理速度の向上」',
  ].join('\n'),
  en: [
    'This is the body text of a web page. Summarize it in English.',
    'Style rules:',
    '- Write each item as a noun phrase, not a full sentence with a finite verb',
    '- Always keep the subject; never drop who or what the item is about',
    '- Keep connectives such as "therefore" or "meanwhile" to show how items relate',
    '- No preamble, no opinions, no phrases like "This article explains"',
    'Example: "They added a new feature, so performance improved."',
    '  -> "Performance gains from the company\'s new feature"',
  ].join('\n'),
  zh: [
    '这是网页的正文，请用简体中文进行摘要。',
    '文体规则：',
    '- 每一条以名词性短语结尾，不要用完整句子',
    '- 必须写出主语，不要省略「谁」「什么」',
    '- 保留「因此」「另一方面」等连接词，体现各条之间的关系',
    '- 不要写前言、感想或「本文介绍了」之类的说明',
    '示例：「由于新增了功能，处理速度提升了。」',
    '  →「该公司新增功能带来的处理速度提升」',
  ].join('\n'),
};

// --- UI ヘルパー -----------------------------------------------------------

// UI文言に使う言語。設定の読み込み後と、設定変更時に更新する。
let uiLang = 'en';

function applyLanguage(lang) {
  uiLang = lang;
  document.documentElement.lang = lang;
  applyI18n(document, lang);
  els.runLabel.textContent = t(lang, 'run');
  const s = lastStatus ?? { key: 'hintIdle', kind: 'info' };
  setStatus(s.key, s.kind, s.params);
}

/** 実行中はボタンを無効化する。進行状態はステータス欄のテキストで示す。 */
function setBusy(busy) {
  els.run.disabled = busy;
  els.run.setAttribute('aria-busy', busy ? 'true' : 'false');
}

// 表示中のメッセージ。言語が変わったら同じ内容で描き直す。
let lastStatus = null;

// 処理中を表すメッセージ。末尾の三点リーダーをアニメーションに差し替える。
const PROGRESS_KEYS = new Set(['fetching', 'generating', 'preparingModel', 'merging']);

/** 「…」を、順に現れる3つの点に置き換えた要素を作る */
function ellipsisEl() {
  const span = document.createElement('span');
  span.className = 'dots';
  span.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) span.append(Object.assign(document.createElement('i'), { textContent: '.' }));
  return span;
}

function setStatus(key, kind = 'info', params) {
  lastStatus = { key, kind, params };
  const text = t(uiLang, key, params);

  if (PROGRESS_KEYS.has(key)) {
    // 点の領域は常に確保されるので、増減しても文字幅は動かない
    els.stateMsg.replaceChildren(text.replace(/[…]+$/, ''), ellipsisEl());
  } else {
    els.stateMsg.textContent = text;
  }
  els.stateMsg.classList.toggle('error', kind === 'error');
  els.state.hidden = false;
}

function showProgress(ratio, label) {
  els.progress.hidden = false;
  els.progressBar.style.width = Math.round(ratio * 100) + '%';
  els.progressLabel.textContent = label ?? '';
}

function hideProgress() {
  els.progress.hidden = true;
  els.progressBar.style.width = '0%';
  els.progressLabel.textContent = '';
}

// 行頭の箇条書き記号（中黒は後ろの空白が無いことも多い）
const BULLET_RE = /^(?:[-*・•]\s*|\d+[.)]\s+)/;

// 語尾を落としても意味が変わらない「コピュラ的な末尾」だけを削って体言止めに寄せる。
// 「〜しました」など動詞の語尾は意味を壊すので触らず、プロンプト側の指示に任せる。
const COPULA_TAIL = /(?:という(?:こと|もの)|と(?:なって|なり)(?:います|ました|いる)|が(?:あります|ある)|(?:して)?(?:います|いる)|です|でした|である|だ)$/;

// 中国語で末尾から落としても意味が変わらない語尾
const ZH_COPULA_TAIL = /(?:了|的|是|存在|具有)$/;

/** 行頭の記号・強調記法・句点を落とし、簡潔な名詞止めに整える */
function tidyLine(line, lang) {
  let out = line
    .replace(BULLET_RE, '')
    .replace(/\*\*/g, '')
    .trim()
    .replace(/[。．.]+$/, '');

  // 末尾の語尾は1回だけ削る（「〜の追加です」→「〜の追加」）。英語は語尾処理をしない。
  if (lang === 'ja') out = out.replace(COPULA_TAIL, '');
  else if (lang === 'zh') out = out.replace(ZH_COPULA_TAIL, '');

  return out.replace(/[、,，]$/, '').trim();
}

/** 要約テキストを DOM として描画する（innerHTML は使わない） */
function renderSummary(text, lang) {
  els.result.replaceChildren();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isBulletList = lines.length > 1 && lines.every((l) => BULLET_RE.test(l));

  if (isBulletList) {
    const ul = document.createElement('ul');
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = tidyLine(line, lang);
      ul.append(li);
    }
    els.result.append(ul);
  } else {
    // 日本語・中国語は段落でも文単位に割る（英語は文末ピリオドで割ると誤爆するのでそのまま）
    for (const line of lines) {
      const sentences = lang === 'en' ? [line] : line.split(/(?<=[。．！？])/);
      for (const sentence of sentences) {
        const cleaned = tidyLine(sentence, lang);
        if (!cleaned) continue;
        const p = document.createElement('p');
        p.textContent = cleaned;
        els.result.append(p);
      }
    }
  }
  els.result.hidden = false;
}

// --- ページ本文の抽出 ------------------------------------------------------
// この関数はタブのページコンテキストで実行されるため、外側の変数を参照しないこと。
function extractPageContent() {
  const BLOCKED = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER',
    'ASIDE', 'FORM', 'BUTTON', 'SELECT',
  ]);
  const TEXT_TAGS = /^(P|LI|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|TD|TH|DD|DT|PRE|FIGCAPTION)$/;

  const visibleText = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        if (BLOCKED.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts = [];
    const seen = new Set();
    let el = walker.currentNode;
    while (el) {
      if (TEXT_TAGS.test(el.tagName)) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (t.length > 1 && !seen.has(t)) {
          seen.add(t);
          parts.push(/^H[1-6]$/.test(el.tagName) ? '\n' + t : t);
        }
      }
      el = walker.nextNode();
    }
    return parts.join('\n');
  };

  // 本文らしいコンテナを優先的に探す
  const candidates = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('[role="main"]'),
    document.querySelector('#content, .content, #main, .main, .post, .entry-content'),
    document.body,
  ].filter(Boolean);

  let best = '';
  for (const node of candidates) {
    const text = visibleText(node);
    if (text.length > best.length) best = text;
    if (best.length > 4000) break; // 十分な量が取れたら打ち切り
  }

  return {
    title: document.title || '',
    url: location.href,
    text: best.replace(/\n{3,}/g, '\n\n').trim(),
  };
}

// 通常は action クリックで付与される activeTab で読み取る。タブを切り替えても
// 使えるようにしたい場合のみ、設定画面からこのオプション権限を許可してもらう。
const HOST_ACCESS = { origins: ['<all_urls>'] };

async function hasHostAccess() {
  try {
    return await chrome.permissions.contains(HOST_ACCESS);
  } catch {
    return false;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ?? null;
}

async function fetchPageContent(tab) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent,
  });
  return injection?.result ?? null;
}

// --- 要約 ------------------------------------------------------------------

async function createSummarizer(options) {
  // モデルのダウンロードが実際に始まったときだけ進捗バーを表示する
  const monitor = (m) => {
    m.addEventListener('downloadprogress', (e) => {
      const loaded = e.loaded ?? 0;
      if (loaded >= 1) {
        hideProgress();
        setStatus('generating');
        return;
      }
      setStatus('preparingModel');
      showProgress(loaded, t(uiLang, 'downloading', { percent: Math.round(loaded * 100) }));
    });
  };

  // 指定言語での出力を要求し、未対応なら言語指定なしで再試行する
  const { language, ...rest } = options;
  try {
    return await SummarizerAPI.create({
      ...rest,
      outputLanguage: language,
      expectedInputLanguages: [...new Set([language, 'en'])],
      monitor,
    });
  } catch (err) {
    console.warn(`[page-summarizer] 出力言語 ${language} の指定に失敗、既定言語で再試行します:`, err);
    return await SummarizerAPI.create({ ...rest, monitor });
  }
}

// 統合を繰り返しても上限に収まらない場合に打ち切る回数
const MAX_MERGE_ROUNDS = 3;

/**
 * text を入力量の上限に収まる断片へ分割する。1つで収まるなら [text] を返す。
 * 下限を設けると、1文字あたりの消費が大きい言語で上限を超えるため設けない。
 */
async function splitToFit(summarizer, text, quota) {
  if (!quota || !text) return [text];
  let usage;
  try {
    usage = await summarizer.measureInputUsage(text);
  } catch {
    return [text]; // 計測非対応ならそのまま渡す
  }
  if (!usage || usage <= quota) return [text];

  // 1文字あたりの消費量から安全な長さを求める（余裕を見て8割）
  const perChar = usage / text.length;
  const size = Math.max(1, Math.floor((quota / perChar) * 0.8));
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

/** 入力量の上限を超える場合は分割要約 → 統合要約を行う */
async function summarizeLongText(summarizer, text, context) {
  let quota = null;
  try {
    quota = summarizer.inputQuota;
  } catch {
    return await summarizer.summarize(text, { context });
  }

  let parts = await splitToFit(summarizer, text, quota);
  if (parts.length === 1) return await summarizer.summarize(text, { context });

  // 統合結果がまた上限を超えることがあるので、収まるまで段階的にまとめ直す
  for (let round = 0; round < MAX_MERGE_ROUNDS; round++) {
    const partials = [];
    for (let i = 0; i < parts.length; i++) {
      showProgress((i + 1) / (parts.length + 1), t(uiLang, 'chunking', { current: i + 1, total: parts.length }));
      partials.push(await summarizer.summarize(parts[i], { context }));
    }

    const merged = partials.join('\n');
    showProgress(1, t(uiLang, 'merging'));
    const next = await splitToFit(summarizer, merged, quota);
    if (next.length === 1) return await summarizer.summarize(merged, { context });
    parts = next;
  }
  // 収束しなかった場合は、最後の分割要約の結合をそのまま返す
  return parts.join('\n');
}

async function run() {
  setBusy(true);
  els.result.hidden = true;
  hideProgress();

  try {
    if (!SummarizerAPI) {
      setStatus('noApi', 'error');
      return;
    }

    const tab = await getActiveTab();
    if (!tab) {
      setStatus('noTab', 'error');
      return;
    }
    // activeTab 未付与だと tab.url は取れない。取れた場合だけ事前に弾く。
    if (tab.url && !/^https?:/.test(tab.url)) {
      setStatus('notWebPage', 'error');
      return;
    }

    setStatus('fetching');
    let page;
    try {
      page = await fetchPageContent(tab);
    } catch (err) {
      console.warn('[web-page-summarizer] executeScript:', err);
      const granted = await hasHostAccess();
      setStatus(granted ? 'cannotReadPage' : 'cannotReadYet', 'error');
      return;
    }

    if (!page || page.text.length < 200) {
      setStatus('tooShort', 'error');
      return;
    }

    els.pageTitle.textContent = page.title;
    els.pageUrl.textContent = page.url;
    els.pageMeta.hidden = false;

    const availability = await SummarizerAPI.availability();
    if (availability === 'unavailable') {
      setStatus('unavailable', 'error');
      return;
    }
    // 進捗バーは実際に downloadprogress が発火したときだけ出す（モデル準備済みなら出さない）
    setStatus('generating');

    const settings = await loadSettings();
    const style = SUMMARY_STYLE[settings.language] ?? SUMMARY_STYLE.en;
    const summarizer = await createSummarizer({
      type: settings.type,
      format: 'plain-text',
      length: settings.length,
      language: settings.language,
      sharedContext: style,
    });

    hideProgress();
    setStatus('generating');
    const summary = await summarizeLongText(
      summarizer,
      page.text,
      `${page.title}\n${style}`,
    );
    summarizer.destroy?.();

    hideProgress();
    els.state.hidden = true;
    renderSummary(summary, settings.language);
  } catch (err) {
    console.error('[page-summarizer]', err);
    hideProgress();
    setStatus('failed', 'error', { message: err?.message ?? String(err) });
  } finally {
    setBusy(false);
  }
}

// --- 起動時チェック --------------------------------------------------------

(async function init() {
  els.run.addEventListener('click', run);
  els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // 先に言語を確定させてから、以降の文言を出す
  const initial = await loadSettings();
  applyLanguage(initial.language);

  // パネルを開いたまま設定画面で言語を変えた場合にも追従させる
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.language?.newValue) {
      applyLanguage(changes.language.newValue);
    }
  });

  if (!SummarizerAPI) {
    setStatus('noApi', 'error');
    els.run.disabled = true;
    return;
  }

  let usable = true;
  try {
    const availability = await SummarizerAPI.availability();
    if (availability === 'unavailable') {
      usable = false;
      setStatus('unavailable', 'error');
      els.run.disabled = true;
    } else if (availability === 'available') {
      setStatus('ready');
    } else {
      setStatus('needsDownload');
    }
  } catch {
    setStatus('unknownState');
  }

  // パネルを開いた時点で自動要約（設定でオフにできる）。
  // アイコンのクリックで activeTab が付与されているので、そのまま読み取れる。
  if (usable && initial.autoRun) run();
})();
