// サイドパネルと設定画面のUI文言。ブラウザのUI言語ではなく、
// 本拡張の「要約の言語」設定に追従させる。

const STRINGS = {
  ja: {
    run: '要約する',
    openSettings: '設定を開く',

    hintIdle: '「要約する」を押すと、表示中のページを要約します。',
    ready: '準備完了です。「要約する」を押してください。',
    needsDownload: '初回実行時にAIモデル(約2GB)のダウンロードが必要です。「要約する」を押すと開始します。',
    noApi: 'このChromeでは内蔵AI(Summarizer API)が見つかりません。\nChrome 138以降にするか、chrome://flags/#summarization-api-for-gemini-nano を Enabled にしてください。',
    unavailable: 'この端末では内蔵AIモデルを利用できません（対応要件を満たしていません）。',
    unknownState: 'AIの状態を確認できませんでした。とりあえず実行してみてください。',

    noTab: '対象のタブが見つかりませんでした。',
    notWebPage: '通常のWebページ(http / https)を開いた状態で実行してください。',
    fetching: 'ページ本文を取得中…',
    generating: '要約を生成中…',
    preparingModel: 'AIモデルを準備しています。初回は数分かかることがあります…',
    downloading: 'AIモデルをダウンロード中… {percent}%',
    chunking: '長文のため分割要約中… ({current}/{total})',
    merging: '分割結果を統合中…',
    tooShort: '要約できるだけの本文が見つかりませんでした。',
    cannotReadPage: 'このページの内容は読み取れません。\nchrome:// やウェブストアなど、拡張機能が動作できないページです。',
    cannotReadYet: 'このページの内容を読み取れませんでした。\n・ツールバーのアイコンをクリックし直すと読み取れます\n・設定画面で「タブを切り替えても要約できるようにする」を有効にすると、押し直さずに使えます',
    failed: '要約に失敗しました: {message}',

    settingsTitle: 'Web Page Summarizer - Local AI の設定',
    saved: '保存しました',
    languageLabel: '表示と要約の言語',
    languageHint: '既定はブラウザの言語です。要約文と、この画面やボタンの表示が切り替わります。',
    lengthLabel: '要約の長さ',
    lengthHint: '1回の要約で出力する分量。',
    lengthShort: '短い',
    lengthMedium: 'ふつう',
    lengthLong: '長い',
    typeLabel: '要約の形式',
    typeHint: 'いずれの形式でも、文末は名詞で終わる形に整形されます。',
    typeKeyPoints: '箇条書き（要点）',
    typeTldr: 'TL;DR（短いまとめ）',
    typeTeaser: 'ティザー（興味を引く導入）',
    typeHeadline: '見出し（1行）',
    otherHeading: 'その他の設定',
    autoRunLabel: 'パネルを開いたら自動で要約する',
    autoRunHint: 'オフにすると、左上の「要約する」を押したときだけ要約します。',
    allSitesLabel: 'タブを切り替えても要約できるようにする',
    allSitesHint: '通常は、ツールバーのアイコンをクリックして開いたページだけを読み取ります。これを有効にすると、以後アクセスするすべてのサイトを読み取れるようになり、アイコンを押し直さずに要約できます。有効化にはChromeの権限ダイアログでの許可が必要です。',
  },

  en: {
    run: 'Summarize',
    openSettings: 'Open settings',

    hintIdle: 'Press Summarize to condense the page you are viewing.',
    ready: 'Ready. Press Summarize to start.',
    needsDownload: 'The AI model (about 2 GB) is downloaded on first use. Press Summarize to begin.',
    noApi: "Chrome's built-in AI (Summarizer API) was not found.\nUse Chrome 138 or later, or enable chrome://flags/#summarization-api-for-gemini-nano.",
    unavailable: 'The built-in AI model is not available on this device (system requirements are not met).',
    unknownState: 'Could not check the AI status. Try running it anyway.',

    noTab: 'No target tab was found.',
    notWebPage: 'Open a regular web page (http / https) and try again.',
    fetching: 'Reading the page…',
    generating: 'Generating the summary…',
    preparingModel: 'Preparing the AI model. The first run can take a few minutes…',
    downloading: 'Downloading the AI model… {percent}%',
    chunking: 'Long page — summarizing in parts ({current}/{total})',
    merging: 'Merging the partial summaries…',
    tooShort: 'Not enough body text was found to summarize.',
    cannotReadPage: 'This page cannot be read.\nExtensions cannot run on chrome:// pages or the Chrome Web Store.',
    cannotReadYet: 'The page could not be read.\n- Click the toolbar icon again to grant access\n- Or turn on "Work after switching tabs" in settings to skip that step',
    failed: 'Summarization failed: {message}',

    settingsTitle: 'Web Page Summarizer - Local AI settings',
    saved: 'Saved',
    languageLabel: 'Interface and summary language',
    languageHint: 'Defaults to your browser language. Changes both the summary text and this interface.',
    lengthLabel: 'Summary length',
    lengthHint: 'How much text each summary produces.',
    lengthShort: 'Short',
    lengthMedium: 'Medium',
    lengthLong: 'Long',
    typeLabel: 'Summary format',
    typeHint: 'Every format is trimmed to end on a noun phrase.',
    typeKeyPoints: 'Key points (bulleted)',
    typeTldr: 'TL;DR (brief)',
    typeTeaser: 'Teaser (hook)',
    typeHeadline: 'Headline (one line)',
    otherHeading: 'Other settings',
    autoRunLabel: 'Summarize automatically when the panel opens',
    autoRunHint: 'When off, summarizing starts only when you press Summarize.',
    allSitesLabel: 'Work after switching tabs',
    allSitesHint: 'By default only the page you opened from the toolbar icon is read. Turning this on lets the extension read every site you visit, so you do not have to click the icon again. Chrome will ask you to approve this.',
  },

};

export const LANGUAGE_LABELS = { en: 'English', ja: '日本語' };

/** 文言を取得する。{name} 形式のプレースホルダを params で置換する。 */
export function t(lang, key, params) {
  const table = STRINGS[lang] ?? STRINGS.en;
  let text = table[key] ?? STRINGS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

/** data-i18n / data-i18n-title を持つ要素へ一括反映する */
export function applyI18n(root, lang) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(lang, el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const label = t(lang, el.dataset.i18nTitle);
    el.title = label;
    el.setAttribute('aria-label', label);
  }
}
