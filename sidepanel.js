// ---------------------------------------------------------------------------
// ページ要約サイドパネル
//   1. アクティブタブに抽出スクリプトを注入して本文テキストを取り出す
//   2. Chrome内蔵AI (Summarizer API / Gemini Nano) で要約する
// ---------------------------------------------------------------------------

import { loadSettings } from './settings.js';

const els = {
  run: document.getElementById('run'),
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

function setStatus(msg, kind = 'info') {
  els.stateMsg.textContent = msg;
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
  let t = line
    .replace(BULLET_RE, '')
    .replace(/\*\*/g, '')
    .trim()
    .replace(/[。．.]+$/, '');

  // 末尾の語尾は1回だけ削る（「〜の追加です」→「〜の追加」）。英語は語尾処理をしない。
  if (lang === 'ja') t = t.replace(COPULA_TAIL, '');
  else if (lang === 'zh') t = t.replace(ZH_COPULA_TAIL, '');

  return t.replace(/[、,，]$/, '').trim();
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
        const t = tidyLine(sentence, lang);
        if (!t) continue;
        const p = document.createElement('p');
        p.textContent = t;
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
        setStatus('要約を生成中…');
        return;
      }
      setStatus('AIモデルを準備しています。初回は数分かかることがあります…');
      showProgress(loaded, `AIモデルをダウンロード中… ${Math.round(loaded * 100)}%`);
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

/** 入力量の上限を超える場合は分割要約 → 統合要約を行う */
async function summarizeLongText(summarizer, text, context) {
  let usage = null;
  let quota = null;
  try {
    usage = await summarizer.measureInputUsage(text);
    quota = summarizer.inputQuota;
  } catch {
    // 非対応ならそのまま投げる
    return await summarizer.summarize(text, { context });
  }

  if (!quota || !usage || usage <= quota) {
    return await summarizer.summarize(text, { context });
  }

  // 文字数ベースでざっくり分割（安全側に 0.8 倍）
  const chunkSize = Math.max(1000, Math.floor((text.length * quota) / usage * 0.8));
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  const partials = [];
  for (let i = 0; i < chunks.length; i++) {
    showProgress((i + 1) / (chunks.length + 1), `長文のため分割要約中… (${i + 1}/${chunks.length})`);
    partials.push(await summarizer.summarize(chunks[i], { context }));
  }
  showProgress(1, '分割結果を統合中…');
  return await summarizer.summarize(partials.join('\n'), { context });
}

async function run() {
  els.run.disabled = true;
  els.result.hidden = true;
  hideProgress();

  try {
    if (!SummarizerAPI) {
      setStatus(
        'このChromeでは内蔵AI(Summarizer API)が使えません。\n' +
          '・Chrome 138以降か確認してください\n' +
          '・chrome://flags/#summarization-api-for-gemini-nano を Enabled にして再起動すると使える場合があります',
        'error',
      );
      return;
    }

    const tab = await getActiveTab();
    if (!tab || !/^https?:/.test(tab.url ?? '')) {
      setStatus('通常のWebページ(http / https)を開いた状態で実行してください。', 'error');
      return;
    }

    setStatus('ページ本文を取得中…');
    const page = await fetchPageContent(tab);

    if (!page || page.text.length < 200) {
      setStatus('要約できるだけの本文が見つかりませんでした。', 'error');
      return;
    }

    els.pageTitle.textContent = page.title;
    els.pageUrl.textContent = page.url;
    els.pageMeta.hidden = false;

    const availability = await SummarizerAPI.availability();
    if (availability === 'unavailable') {
      setStatus('この端末では内蔵AIモデルを利用できません（対応要件を満たしていません）。', 'error');
      return;
    }
    // 進捗バーは実際に downloadprogress が発火したときだけ出す（モデル準備済みなら出さない）
    setStatus('要約を生成中…');

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
    setStatus('要約を生成中…');
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
    setStatus('要約に失敗しました: ' + (err?.message ?? String(err)), 'error');
  } finally {
    els.run.disabled = false;
  }
}

// --- 起動時チェック --------------------------------------------------------

(async function init() {
  els.run.addEventListener('click', run);
  els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());

  if (!SummarizerAPI) {
    setStatus(
      'このChromeでは内蔵AI(Summarizer API)が見つかりません。\n' +
        'Chrome 138以降にするか、chrome://flags/#summarization-api-for-gemini-nano を Enabled にしてください。',
      'error',
    );
    els.run.disabled = true;
    return;
  }

  let usable = true;
  try {
    const availability = await SummarizerAPI.availability();
    if (availability === 'unavailable') {
      usable = false;
      setStatus('この端末では内蔵AIモデルを利用できません（対応要件を満たしていません）。', 'error');
      els.run.disabled = true;
    } else if (availability === 'available') {
      setStatus('準備完了です。「要約する」を押してください。');
    } else {
      setStatus('初回実行時にAIモデル(約2GB)のダウンロードが必要です。「要約する」を押すと開始します。');
    }
  } catch {
    setStatus('AIの状態を確認できませんでした。とりあえず実行してみてください。');
  }

  // パネルを開いた時点で自動要約（設定でオフにできる）
  if (usable) {
    const { autoRun } = await loadSettings();
    if (autoRun) run();
  }
})();
