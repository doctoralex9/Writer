// Basic content script - will be expanded
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "refine") {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // For now, alert placeholder. Later: call LLM and replace text
      alert("Selected: " + selectedText.substring(0, 100) + "...\n\n(LLM integration coming next)");
      // TODO: Send to background or popup for LLM call and replace
    } else {
      alert("Select some text first!");
    }
  }
});

// Voice mode placeholder
console.log("Refine extension loaded - Voice & AI ready for integration");