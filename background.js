const STYLE_MENU_ITEMS = [
  { id: "professional", title: "Professional" },
  { id: "concise", title: "Concise" },
  { id: "confident", title: "Confident" },
  { id: "custom", title: "My Style" }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "refine-parent",
    title: "Refine with Texter",
    contexts: ["selection"]
  });
  for (const item of STYLE_MENU_ITEMS) {
    chrome.contextMenus.create({
      id: `refine-${item.id}`,
      parentId: "refine-parent",
      title: item.title,
      contexts: ["selection"]
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  const style = info.menuItemId.startsWith("refine-")
    ? info.menuItemId.slice("refine-".length)
    : null;
  if (style) {
    chrome.tabs.sendMessage(tab.id, { action: "refine", style });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "refine-text") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "refine", style: "professional" });
      }
    });
  }
});

const STYLE_PROMPTS = {
  professional: "Rewrite the following text to sound more professional and polished, while keeping the original meaning and length roughly the same.",
  concise: "Rewrite the following text to be more concise, cutting unnecessary words while preserving the original meaning.",
  confident: "Rewrite the following text to sound more confident and direct, while preserving the original meaning.",
  custom: null
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callLLM") {
    callOpenAI(request.text, request.style)
      .then((result) => sendResponse({ ok: true, text: result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function callOpenAI(text, style) {
  const { apiKey, customStyle } = await chrome.storage.local.get(["apiKey", "customStyle"]);

  if (!apiKey) {
    throw new Error("No API key set. Click the Texter icon to add your OpenAI API key.");
  }

  let instruction = STYLE_PROMPTS[style];
  if (style === "custom") {
    if (!customStyle) {
      throw new Error("No custom style set. Click the Texter icon to add one.");
    }
    instruction = `Rewrite the following text according to this style guide: "${customStyle}". Preserve the original meaning.`;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${instruction} Reply with only the rewritten text and nothing else — no quotes, no explanations, no preamble.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid API key.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited or quota exceeded.");
    }
    throw new Error(`OpenAI request failed (${response.status}).`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim();
  if (!result) {
    throw new Error("Empty response from OpenAI.");
  }
  return result;
}
