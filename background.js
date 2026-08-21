// ツールバーのアイコンクリックでサイドパネルを開く
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[page-summarizer] setPanelBehavior:', err));
