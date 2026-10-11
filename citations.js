// citations.js: clickable evidence citations for AI speeches.
//
// Input: the raw "sourced" speech text from the backend ([S#] tags after cited
// sentences, {{S#|phrase}} indirect references, trailing SOURCES: block) plus
// the sources array [{tag, cite, url, title, live}]. Output: safe HTML where
// the author-year (or the referring phrase) is a link that scrolls to and
// highlights the matching entry in that speech's source list. Students never
// see tags, braces, µ, or raw URLs inline.
//
// Everything is escaped through pfSanitize; the only HTML that survives is
// built here. Depends on sanitize.js.
(function () {
  var S0 = "", S1 = "", S2 = ""; // private-use sentinels
  var AUTHOR_YEAR = /[A-Z][\w.&’'-]*(?:\s+(?:[A-Z][\w.&’'-]*|and|&)){0,3}\s*[’']\d\d/g;

  function mark(num, label) { return S0 + num + S1 + label + S2; }

  function stripNoise(body) {
    return body
      .replace(/\(\[[^\]]+\]\([^)]+\)\)/g, "")
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
      .replace(/µ/g, "")
      .replace(/Ladies and Gentlemen/g, "judge");
  }

  function citeFor(sources, num) {
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].tag === "S" + num) return sources[i].cite || ("S" + num);
    }
    return null;
  }

  // Turn the raw sourced body into text with sentinel-marked link spans.
  function markCitations(body, sources) {
    // Indirect references: the wrapped phrase becomes the link.
    body = body.replace(/\{\{S(\d+)\|([^}|{]*)\}\}/g, function (_, num, phrase) {
      return mark(num, phrase.trim());
    });

    // Direct tags: link the author-year mention preceding the tag.
    var parts = body.split(/\[S(\d+)\]/);
    var out = parts[0];
    for (var i = 1; i < parts.length; i += 2) {
      var num = parts[i];
      // Look back up to a long quoted card (Luna's evidence sentences often
      // run past 400 characters, and a short window left the author-year
      // unlinked with a bracketed label tacked on instead), but never across
      // an earlier citation marker: matching inside another marker's label
      // nests them and corrupts both.
      var tail = out.slice(-700);
      var prevMarker = tail.lastIndexOf(S2);
      if (prevMarker >= 0) tail = tail.slice(prevMarker + 1);
      var m, last = null;
      AUTHOR_YEAR.lastIndex = 0;
      while ((m = AUTHOR_YEAR.exec(tail)) !== null) last = m;
      if (last) {
        var at = out.length - tail.length + last.index;
        out = out.slice(0, at) + mark(num, last[0]) + out.slice(at + last[0].length);
      } else {
        // No author-year nearby (rare): append a labelled marker instead.
        var cite = citeFor(sources, num);
        if (cite) out = out.replace(/\s*$/, "") + " " + mark(num, "[" + cite + "]");
      }
      out += parts[i + 1] || "";
    }
    return out;
  }

  function bodyHtml(sourcedText, sources, listId) {
    var body = stripNoise(String(sourcedText || "").split("SOURCES:")[0]);
    var marked = markCitations(body, sources || []);
    var html = pfSanitize(marked); // escapes everything, keeps sentinels
    // SECURITY INVARIANTS (adversarially verified 2026-08-10; keep both or
    // model text that emits the sentinel characters can inject markup):
    //  1. num is captured as (\d+) only — digits cannot break out of the href
    //     or the data attribute. Never widen this capture group.
    //  2. label goes into element-content position and was already escaped by
    //     pfSanitize above. Never move it into an attribute.
    // Held, injected sentinels can at worst forge a harmless internal link.
    return html.replace(new RegExp(S0 + "(\\d+)" + S1 + "([\\s\\S]*?)" + S2, "g"),
      function (_, num, label) {
        return '<a href="#' + listId + '-S' + num + '" class="pf-cite" data-pf-tag="S' + num + '">' + label + "</a>";
      });
  }

  function listHtml(sources, listId) {
    if (!sources || !sources.length) return "";
    var items = sources.map(function (s) {
      var label = pfSanitize.escape(s.cite || s.tag);
      var title = s.title || s.url || "";
      var body = (s.live !== false && s.url)
        ? pfSanitize.link(s.url, title)
        : pfSanitize.escape(title) + ' <span class="pf-src-dead">(link unavailable)</span>';
      return '<li id="' + listId + "-" + pfSanitize.escape(s.tag) + '">' +
        '<span class="pf-src-cite">' + label + ":</span> " + body + "</li>";
    });
    return '<div class="pf-src-head">Sources</div><ol class="pf-src-list">' + items.join("") + "</ol>";
  }

  // Render a speech and its source list into their two containers.
  function renderInto(textElId, listElId, sourcedText, sources) {
    var textEl = document.getElementById(textElId);
    var listEl = document.getElementById(listElId);
    if (!textEl) return false;
    textEl.innerHTML = "<p>" + bodyHtml(sourcedText, sources, listElId) + "</p>";
    if (listEl) listEl.innerHTML = listHtml(sources, listElId);
    return true;
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".pf-cite");
    if (!a) return;
    e.preventDefault();
    var target = document.getElementById((a.getAttribute("href") || "").slice(1));
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("pf-src-flash");
    void target.offsetWidth; // restart the animation on repeat clicks
    target.classList.add("pf-src-flash");
  });

  var css = document.createElement("style");
  css.textContent =
    ".pf-cite{color:var(--pf-accent,#7DD3FC);text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer;font-weight:600;}" +
    ".pf-cite:hover{text-decoration:underline;}" +
    ".pf-sources{white-space:normal;}" +
    ".pf-sources:empty{display:none;}" +
    ".pf-src-head{margin-top:14px;padding-top:10px;border-top:1px solid var(--pf-border-subtle,#183756);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--pf-text-muted,#8AA6C2);}" +
    ".pf-src-list{margin:6px 0 0;padding-left:1.4em;font-size:12.5px;line-height:1.45;color:var(--pf-text-2,#A9C3DB);}" +
    ".pf-src-list li{margin-bottom:5px;overflow-wrap:anywhere;border-radius:4px;}" +
    ".pf-src-list a{color:var(--pf-accent,#7DD3FC);}" +
    ".pf-src-cite{font-weight:600;color:var(--pf-text,#E8F1FA);}" +
    ".pf-src-dead{opacity:.6;font-style:italic;}" +
    ".pf-src-flash{animation:pfSrcFlash 1.6s ease-out;}" +
    "@keyframes pfSrcFlash{0%{background:rgba(252,211,77,.22);}100%{background:transparent;}}";
  document.head.appendChild(css);

  window.pfCitations = { renderInto: renderInto, bodyHtml: bodyHtml, listHtml: listHtml };
})();
