# Chrome Web Store listing — English

Paste-ready text for the English locale. The Japanese version lives in `STORE-LISTING.md`.

---

## Name (max 75 characters)

```
Web Page Summarizer - Local AI
```

## Summary (max 132 characters)

```
Summarize any page with Chrome's built-in AI. Nothing leaves your device. No API key, no account, no cost.
```

## Detailed description

```
Read the gist of any page in seconds. Web Page Summarizer pulls the article text
from the page you are on and shows a summary in Chrome's side panel.

■ Your reading never leaves your computer
Summaries are produced by Gemini Nano, the AI model built into Chrome, running
entirely on your own machine. Page content is never uploaded to any server —
not ours, not anyone's. Safe to use on internal documents and unpublished drafts.

■ No API key, no account, no cost
There is nothing to sign up for and no OpenAI or Gemini key to paste in. Install
it and it works. It keeps working offline once the model has been downloaded.

■ How to use it
1. Open the page you want summarized and click the toolbar icon
2. The side panel opens and the summary appears automatically

■ Make it yours
- Language: English, Japanese, or Simplified Chinese — for both the summary and
  the interface
- Length: short, medium, or long
- Format: key points, TL;DR, teaser, or headline
- Turn off automatic summarizing if you prefer to press the button yourself

■ Requirements
- Chrome 138 or later, desktop only
- About 2 GB is downloaded once, the first time you use it — this is Chrome's
  AI model, not your page content
- 22 GB free storage and 4 GB VRAM or more

■ Good to know
- Extensions cannot run on chrome:// pages or the Chrome Web Store
- PDF files are not supported yet
- Long pages are summarized in parts and then combined
```

## Category

Tools

---

## Privacy tab

### Single purpose

```
The sole purpose of this extension is to summarize the text of the web page the
user is currently viewing and display that summary in the side panel. Summaries
are generated on the user's own device by Chrome's built-in Summarizer API
(Gemini Nano). Page content is never transmitted anywhere.
```

### Permission justifications

**activeTab**
```
Used to read the body text of the tab the user opened the extension on, and only
that tab. The text is the input to the summary.
```

**scripting**
```
Used to run a small extraction script in the target tab that collects the article
text. The extracted text is held in memory, then discarded once the summary is
produced. It is never stored or transmitted.
```

**sidePanel**
```
Used to open the side panel in which the generated summary is displayed.
```

**storage**
```
Used to save the user's own preferences: summary language, length, format, and
whether to summarize automatically. No browsing data or personal information is
stored.
```

**Host permission `<all_urls>` (optional)**
```
Not requested by default. It is requested through Chrome's permission dialog only
when the user explicitly enables "Work after switching tabs" in the options page.
It lets the extension summarize a tab the user did not launch it from, removing
the need to click the toolbar icon again. Disabling the setting revokes the
permission.
```

### Remote code

```
Not used. All code ships inside the extension package.
```

### Data usage

Select "does not collect" for every category, and tick all three certifications.

### Privacy policy URL

```
https://3teku.github.io/web-page-summarizer/
```

### Source code (if the reviewer asks)

```
https://github.com/3Teku/web-page-summarizer
```
