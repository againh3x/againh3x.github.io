// sanitize.js — escape-then-format rendering for LLM and user text.
// Everything is escaped first; the only markup that survives is markup this
// site generates itself: <br> for newlines, <strong> for feedback headers
// written as **header**, and anchors built through pfSanitize.link().
(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pfSanitize(text) {
    if (text == null) return "";
    var out = escapeHtml(text);
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\n/g, "<br>");
    return out;
  }

  pfSanitize.escape = escapeHtml;

  // Build a safe anchor for a URL we vetted ourselves (http/https only).
  pfSanitize.link = function (url, label) {
    var parsed;
    try { parsed = new URL(url); } catch (e) { return escapeHtml(label || url || ""); }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return escapeHtml(label || url);
    }
    return '<a href="' + escapeHtml(parsed.href) + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label || parsed.href) + "</a>";
  };

  window.pfSanitize = pfSanitize;
})();
