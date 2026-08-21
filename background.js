// アイコンのクリックで直接サイドパネルを開かせず、onClicked で受けてから開く。
// こうするとクリック時に activeTab が付与され、そのタブの本文を読み取れる。
// （openPanelOnActionClick: true だとクリックがパネル起動に消費され、権限が付与されない）
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((err) => console.error('[web-page-summarizer] setPanelBehavior:', err));

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    // タブ単位で開けない場合はウィンドウ単位で開く
    console.warn('[web-page-summarizer] sidePanel.open(tabId):', err);
    if (tab.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
