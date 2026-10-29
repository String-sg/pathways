const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

function card(p, r){
  const cls = r.state === "ok" ? "c-ok" : r.state === "amber" ? "c-amber" : "c-bad";
  const mark = r.state === "ok" ? "✓" : r.state === "amber" ? "!" : "✕";
  const pill = r.state === "ok" ? `<span class="pill p-ok st">Prerequisites Met*</span>` : r.state === "amber" ? `<span class="pill p-amber st">Conditional</span>` : `<span class="pill p-bad st">Not Eligible</span>`;

  let aggBadge = "";
  if (r.aggregate) {
    const agg = r.aggregate;
    const meets = agg.meetsCutoff !== false;
    const aggCls = meets ? "p-ok" : "p-bad";
    const netTxt = (agg.net !== undefined && agg.net !== null && agg.net !== agg.gross) ? ` • Net ${agg.net}` : "";
    const cutTxt = agg.cutoff ? ` (≤${agg.cutoff})` : "";
    const scoreVal = agg.gross !== undefined ? `Gross ${agg.gross}${netTxt}` : (agg.score ?? "");
    aggBadge = `<span class="pill ${aggCls} agg-badge" title="${esc(agg.type || "Aggregate score")}">${esc(agg.type || "Score")}: ${esc(scoreVal)}${esc(cutTxt)}</span>`;
  }

  const body = r.state === "bad"
    ? `<p style="color:var(--bad);font-weight:700">Prerequisites needed:</p><ul>${r.miss.map(m => `<li>${esc(m)}</li>`).join("")}</ul>`
    : `<div class="main"><p>${esc(r.what)}</p>${r.req ? `<div class="req"><b>Requirements Check:</b><ul>${r.req.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div><p class="next"><span>Leads to:</span> ${esc(p.next)}</p>`;

  const note = r.note ? `<p style="font-size:11.5px;color:var(--muted);margin-top:6px;border-top:1px dashed #d0dbe2;padding-top:4px;">💡 ${esc(r.note)}</p>` : "";

  return `<article class="card ${cls}">
    <div class="card-h">
      <div class="badge">
        <div class="inst"><svg viewBox="0 0 24 24"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H19v-5"/></svg></div>
        <span class="mark">${mark}</span>
      </div>
      <div>
        <h3>${esc(p.name)}</h3>
        <div class="card-pills">
          ${pill}
          ${aggBadge}
        </div>
      </div>
    </div>
    <div class="card-body">${body}${note}</div>
  </article>`;
}

export { card };
