// Developer Debug Overlay - Issue #7 (Contributor: Shishir)
//
// Shows a live reading progress indicator:
// "Reading: 3 / 42 paragraphs (7%)"

export function showDebugOverlay(info) {
  let box = document.getElementById("hoda-debug-overlay");
  if (!box) {
    box = document.createElement("div");
    box.id = "hoda-debug-overlay";
    box.style.position = "fixed";
    box.style.bottom = "20px";
    box.style.left = "20px";
    box.style.padding = "10px 14px";
    box.style.background = "rgba(0,0,0,0.7)";
    box.style.color = "white";
    box.style.fontSize = "12px";
    box.style.borderRadius = "6px";
    box.style.zIndex = "999999";
    box.style.fontFamily = "monospace";
    document.body.appendChild(box);
  }

  box.textContent = `Reading: ${info.current} / ${info.total} (${info.percentage}%)`;
}
