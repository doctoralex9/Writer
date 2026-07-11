chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "refine",
    title: "Refine with AI",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "refine") {
    chrome.tabs.sendMessage(tab.id, { action: "refine" });
  }
});

// Handle keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === "refine-text") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "refine" });
    });
  }
});