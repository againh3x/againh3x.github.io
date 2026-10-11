var toggleFlowButton = document.getElementById('toggle-flow');
var generateFeedbackButton = document.getElementById('download-btn')
var recordButtonC = document.getElementById('recordButtonContention');
var speakButtonAI = document.getElementById('SpeakAIContention');
var generateButtonAI = document.getElementById('GenerateAIContention')
var transcriptionResultC = document.getElementById('transcriptionContentionText');
var transcriptionResultR = document.getElementById('transcriptionRebuttalText')
var transcriptionResultS = document.getElementById('SummaryUserText');
var transcriptionResultF = document.getElementById('FFUserText')
var UserFlowDiv = document.getElementById('UserFlow');
var AIFlowDiv = document.getElementById('AIFlow');
var AIRebuttalButton = document.getElementById('speakAIRebuttal');
var GenerateAIRebuttalB = document.getElementById('GenerateAIRebuttal')
var recordButtonR = document.getElementById('recordButtonRebuttal');
var AISummarySpeakB = document.getElementById('SpeakAISummary');
var AISummaryGenerateB = document.getElementById('GenerateAISummary');
var AIFFSpeakB = document.getElementById('SpeakAIFF');
var AIFFGenerateB = document.getElementById('GenerateAIFF');
var recordButtonS = document.getElementById('recordButtonSummary');
var recordButtonF = document.getElementById('recordButtonFF');
var rebuttalFlowUpdated;
var ToggleisSelectedSide;
var recognition;
var recognitionR;
var recognitionS;
var recognitionF;
var isRecordingC = false;
var isRecordingR = false;
var isRecordingS = false;
var isRecordingF = false;
var fullTranscriptionContention = '';
var fullAIContentionRaw = '';
var fullAIRebuttal = '';
var fullTranscriptionRebuttal = '';
var fullTranscriptionSummary = '';
var fullTranscriptionFF = '';
let isSpeaking = false;
var isRebutting = false;
var isGenerating = false;
var isSpeakingR = false;
var isSpeakingS = false;
var isSpeakingF = false;
var isSummarying = false;
var isFFing = false;
let currentAudio = null;
let mediaRecorder;
let audioChunks = [];
let audioStream;
let animationFrame;
let recordingStartTime;
var judgeType = 'tech';
var roundOver;

let __roundSavedToProfile = false;
var __savedRoundKey = null;

function getDebateTopicSafe(){
  try { return (typeof debateTopic !== "undefined" && debateTopic) ? debateTopic
             : (new URLSearchParams(location.search).get('debateTopic') || 'Untitled Topic'); }
  catch { return 'Untitled Topic'; }
}

// Gate for actions the backend cannot protect on its own, namely opening the
// microphone. Everywhere else a missing gate.js is harmless because the server
// rejects the unauthenticated call, but a mic that opens is a mic that opened.
// So this one fails closed: no gate.js means send them to sign in.
async function pfGateOrLogin(opts) {
    if (!window.pfGate) {
        location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search);
        return false;
    }
    return await pfGate.requireAuth(opts);
}

function pfHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

/* ===== Derived cell state: borders, labels, locks, and the glow =============
   Two sheets of four cells each. 'my' is the user's sheet (their case plus
   the AI answering it); 'ai' is the AI's sheet. Column order per sheet:
   0 Case, 1 Rebuttal, 2 Summary, 3 Final Focus. A generate cell is done when
   its content exists; a record cell is done when its flow cell holds flowed
   output (see pfFlowCellDone). Listening and generating are transient flags
   set around the existing call sites. */

var PF_BUSY = { my: [null, null, null, null], ai: [null, null, null, null] };

var PF_SHEET_COLS = {
    my: ['transcriptionContention', 'RebuttalAI', 'SummaryUser', 'FinalFocusAI'],
    ai: ['AIContention', 'RebuttalUser', 'SummaryAI', 'ffUser']
};
var PF_PRIMARY = {
    my: ['recordButtonContention', 'GenerateAIRebuttal', 'recordButtonSummary', 'GenerateAIFF'],
    ai: ['GenerateAIContention', 'recordButtonRebuttal', 'GenerateAISummary', 'recordButtonFF']
};
var PF_SPEAK = {
    my: { 1: 'speakAIRebuttal', 3: 'SpeakAIFF' },
    ai: { 0: 'SpeakAIContention', 2: 'SpeakAISummary' }
};
var PF_IS_RECORD = { my: [true, false, true, false], ai: [false, true, false, true] };

// A record cell is done only when it holds a flowed speech. Every /process*
// success and every restore path writes <p>-wrapped HTML; the guidance
// messages ("Please record a full...") are plain text and do not count, so a
// failed or rejected recording leaves the cell empty and Record unlocked.
// This keys the free-plan redo gate on the same event the server keys its
// own redo gate on: a /process* call that actually persisted.
function pfFlowCellDone(elId) {
    var el = document.getElementById(elId);
    return !!(el && el.querySelector('p'));
}

function pfCellDone(sheet, i) {
    if (sheet === 'my') {
        if (i === 0) return pfFlowCellDone('transcriptionContentionText');
        if (i === 1) return document.getElementById('AIRebuttalText').innerHTML !== '';
        if (i === 2) return pfFlowCellDone('SummaryUserText');
        return document.getElementById('AIFFText').innerHTML !== '';
    }
    if (i === 0) return document.getElementById('AIContentionText').innerHTML !== '';
    if (i === 1) return pfFlowCellDone('transcriptionRebuttalText');
    if (i === 2) return document.getElementById('AISummaryText').innerHTML !== '';
    return pfFlowCellDone('FFUserText');
}

function pfCellState(sheet, i) {
    return PF_BUSY[sheet][i] || (pfCellDone(sheet, i) ? 'done' : 'empty');
}

function pfCellBusy(sheet, i, state) {
    PF_BUSY[sheet][i] = state;
    pfRoundUIRefresh();
}

function pfCellIdle(sheet, i) {
    PF_BUSY[sheet][i] = null;
    pfRoundUIRefresh();
}

// Only one recording runs at a time, so a mic failure can safely clear every
// listening flag without knowing which cell asked for the mic.
function pfClearListening() {
    ['my', 'ai'].forEach(function (sheet) {
        for (var i = 0; i < 4; i++) {
            if (PF_BUSY[sheet][i] === 'listening') PF_BUSY[sheet][i] = null;
        }
    });
    pfRoundUIRefresh();
}

/* pfNextSpeech(cells, youFirst) -> { sheet: 'my'|'ai', i: 0..3 } or null.
   cells = { my: [s0,s1,s2,s3], ai: [s0,s1,s2,s3] } where each entry is the
   cell state and 'done' means that speech is flowed. Columns per sheet:
   0 Case, 1 Rebuttal, 2 Summary, 3 Final Focus. 'my' is the user's sheet
   (the user's case plus the AI answering it); 'ai' is the AI's sheet.
   youFirst is true when the user speaks first. When resuming a server
   draft, build cells by marking a slot 'done' when its content field is
   non-empty, 'empty' otherwise, then recompute the glow from this. */
function pfNextSpeech(cells, youFirst) {
  var seq = youFirst
    ? [['my', 0], ['ai', 0], ['ai', 1], ['my', 1], ['my', 2], ['ai', 2], ['ai', 3], ['my', 3]]
    : [['ai', 0], ['my', 0], ['my', 1], ['ai', 1], ['ai', 2], ['my', 2], ['my', 3], ['ai', 3]];
  for (var k = 0; k < seq.length; k++) {
    var sheet = seq[k][0], i = seq[k][1];
    if (cells[sheet][i] !== 'done') return { sheet: sheet, i: i };
  }
  return null;
}

function pfIsFree() {
    return window.__pfPlan === 'free';
}

function pfRedoBlocked(sheet, i) {
    return pfIsFree() && pfCellDone(sheet, i);
}

// 16px padlock pinned outside the button's layout, so it never grows.
var PF_LOCK_SVG = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

function pfLockBadge(btn, on) {
    if (!btn) return;
    var badge = btn.querySelector('.pf-lock-badge');
    if (on && !badge) {
        badge = document.createElement('span');
        badge.className = 'pf-lock-badge';
        badge.title = 'Premium feature';
        // Static SVG only, no dynamic content.
        badge.innerHTML = PF_LOCK_SVG;
        btn.appendChild(badge);
    }
    if (!on && badge) badge.remove();
}

// Repaints everything the cell states drive: column border tints, the
// Record/Generate/Redo labels, free-plan lock badges, and the single glow.
function pfRoundUIRefresh() {
    var cells = { my: [], ai: [] };
    ['my', 'ai'].forEach(function (sheet) {
        for (var i = 0; i < 4; i++) {
            var st = pfCellState(sheet, i);
            cells[sheet][i] = st;

            var col = document.getElementById(PF_SHEET_COLS[sheet][i]);
            if (col) col.setAttribute('data-state', st);

            var btn = document.getElementById(PF_PRIMARY[sheet][i]);
            if (btn) {
                var locked = pfRedoBlocked(sheet, i) && !PF_BUSY[sheet][i];
                // Never clobber an in-flight 'Stop' label or a 429 countdown.
                if (!PF_BUSY[sheet][i] && !btn.dataset.pfCooldown) {
                    var base = PF_IS_RECORD[sheet][i] ? 'Record' : 'Generate';
                    btn.textContent = (st === 'done') ? 'Redo' : base;
                }
                btn.classList.toggle('pf-locked', locked);
                pfLockBadge(btn, locked);
            }

            var speakId = PF_SPEAK[sheet][i];
            if (speakId) pfLockBadge(document.getElementById(speakId), pfIsFree());
        }
    });

    // Exactly one button glows: the next speech in the round. When it lives
    // on the sheet the user is not looking at, Toggle glows instead. Nothing
    // glows while that speech is already listening or generating.
    var glowing = document.querySelectorAll('.glowing');
    for (var g = 0; g < glowing.length; g++) glowing[g].classList.remove('glowing');
    var youFirst = document.getElementById('selectedTurn').textContent === 'First';
    var next = pfNextSpeech(cells, youFirst);
    if (next && !PF_BUSY[next.sheet][next.i]) {
        var visibleSheet = ToggleisSelectedSide ? 'my' : 'ai';
        if (next.sheet === visibleSheet) {
            var target = document.getElementById(PF_PRIMARY[next.sheet][next.i]);
            if (target) target.classList.add('glowing');
        } else {
            toggleFlowButton.classList.add('glowing');
        }
    }
}

function pfShowBallotLink() {
    var link = document.getElementById('ballotLink');
    if (link && window.__currentRoundId) {
        link.href = 'ballot.html?round=' + encodeURIComponent(window.__currentRoundId);
        link.hidden = false;
    }
}

/* ===== Draft persistence to the account ====================================
   Speech content is persisted server-side by the speech endpoints themselves
   (payloads carry roundId whenever a server draft exists), so the debounced
   PATCH only carries the judge choice. Sending the page's innerHTML copies of
   AI speeches would trip the server's free-plan redo guard, which compares
   against the raw strings it stored itself. */
var __draftPatchTimer = null;
var __draftPatchDisabled = false;

function scheduleDraftPatch() {
    if (__draftPatchDisabled || !window.__currentRoundId) return;
    if (typeof window.pfRoundPatch !== 'function') return;
    clearTimeout(__draftPatchTimer);
    __draftPatchTimer = setTimeout(flushDraftPatch, 2000);
}

function flushDraftPatch() {
    clearTimeout(__draftPatchTimer);
    __draftPatchTimer = null;
    if (__draftPatchDisabled || !window.__currentRoundId) return;
    if (typeof window.pfRoundPatch !== 'function') return;
    var jt = (typeof judgeType === 'string' && judgeType) ? judgeType : 'tech';
    pfRoundPatch(window.__currentRoundId, { judgeType: jt },
        { page: 'Flow', quiet: true, noUpsell: true })
        .catch(function (err) {
            // 404: not a server draft (legacy local round). 409: finished.
            // Either way, stop patching; localStorage still has everything.
            if (err && (err.status === 404 || err.status === 409)) __draftPatchDisabled = true;
        });
}

window.addEventListener('beforeunload', flushDraftPatch);
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushDraftPatch();
});

document.addEventListener('DOMContentLoaded', function () {
    // Parse URL parameters. The legacy long names are canonical; the short
    // names are accepted so a setup page emitting the contract's short form
    // still lands in a valid round.
    const params = new URLSearchParams(window.location.search);

    // Get all parameters
    const selectedSide = params.get('selectedSide') || params.get('side');
    const selectedTurn = params.get('selectedTurn') || params.get('turn');
    const selectedSkill = params.get('selectedSkill') || params.get('skill');
    debateTopic = params.get('debateTopic') || params.get('topic');

    // Server draft id: the round's identity across devices and reloads.
    const roundIdParam = params.get('round');
    if (roundIdParam) window.__currentRoundId = roundIdParam;

    // A round needs all four settings; anything else goes back to setup.
    const validRound =
        (selectedSide === 'Aff' || selectedSide === 'Neg') &&
        (selectedTurn === 'First' || selectedTurn === 'Second') &&
        (selectedSkill === 'middle' || selectedSkill === 'high') &&
        typeof debateTopic === 'string' && debateTopic.trim() !== '' && debateTopic.length <= 500;
    if (!validRound) {
        location.replace('setup.html?error=missing-params');
        return;
    }

    // Set text content for ALL parameters
    document.getElementById('selectedSide').textContent = selectedSide;
    document.getElementById('selectedTurn').textContent = selectedTurn;
    document.getElementById('selectedSkill').textContent = selectedSkill;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';

    // The Settings dropdown shows the same settings in full words.
    pfSetText('settingsTopic', debateTopic);
    pfSetText('settingsSide', pfFullSide(selectedSide));
    pfSetText('settingsTurn', selectedTurn);
    pfSetText('settingsLevel', selectedSkill === 'middle' ? 'Middle School' : 'High School');

    // Check if the user is the second speaker
    if (selectedTurn.toLowerCase() === 'second') {
        document.getElementById('transcriptionContention').classList.add('second-speaker');
        ToggleisSelectedSide = false;
        toggleFlowButton.textContent = 'Toggle ' + selectedSide;
    } else {
        ToggleisSelectedSide = true;
        toggleFlowButton.textContent = 'Toggle ' + nonselectedSide;
    }

    updateFlowValues(selectedSide, nonselectedSide);

    // Entering a round requires an account; the saved round is per user and
    // per round settings, so both wait on auth.
    if (!window.pfGate) return;
    pfGate.requireAuth({ page: 'Flow' }).then(function (ok) {
        if (!ok) return;
        return pfGate.authUser().then(function (user) {
            if (!user) return;
            // selectedSkill is part of the key: a middle-school round and a
            // high-school round on the same topic are different rounds.
            __savedRoundKey = 'savedRound::' + user.uid + '::' +
                pfHash(debateTopic + '|' + selectedSide + '|' + selectedTurn + '|' + selectedSkill);
            initRoundState(selectedSide, nonselectedSide);
        });
    });

});

function pfSetText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function pfFullSide(side) {
    return side === 'Aff' ? 'Affirmative' : 'Negative';
}

// Resume order: local saved state first (it carries the rendered flow HTML
// the server never sees), then the server draft on top (it is the source of
// truth for transcripts, AI speeches, feedback, and judge choice). Fresh
// entries without a draft id start a server draft so the speech endpoints,
// which require an owned draft, have one to write into.
async function initRoundState(selectedSide, nonselectedSide) {
    var expectedId = window.__currentRoundId || null;
    restoreSavedRound(selectedSide, nonselectedSide, expectedId);

    var id = window.__currentRoundId;
    var isServerId = !!id && String(id).indexOf('r_') !== 0;
    if (isServerId && typeof window.pfRound === 'function') {
        // A server draft id, whether it came from ?round or from a restored
        // save: the server copy is the source of truth either way.
        window.__pfServerDraft = true;
        try {
            var doc = await pfRound(id, { page: 'Flow', quiet: true });
            applyServerRound(doc, selectedSide, nonselectedSide);
        } catch (e) {
            console.error('Could not load this round from your account:', e);
        }
        if (!expectedId) {
            // Restored without ?round in the URL: put the id back so a
            // reload resumes this draft instead of starting a new one.
            try {
                var u = new URL(location.href);
                u.searchParams.set('round', id);
                history.replaceState(null, '', u);
            } catch (e2) { }
        }
    } else if (id) {
        // A locally minted id (r_...): keep the legacy server copy of the
        // old-format round. It cannot host generation (the speech endpoints
        // only write into a real draft), so the first speech action starts
        // one and it takes over as this round's id.
        try {
            var round = Object.assign({}, captureState(), { id: id, meta: currentRoundMeta() });
            syncRoundToServer(round);
        } catch (e3) { /* localStorage still has the round */ }
    }
    // No draft is started here on purpose. Starting one spends a monthly
    // round, and getDebateTopicSafe falls back to "Untitled Topic", so merely
    // opening Flow.html from a bookmark or history would have cost a round
    // without the server's empty-topic guard ever firing. Every action site
    // awaits pfRequireServerDraft, so the draft appears at the first speech
    // instead, which is also when the user has actually committed to a round.

    loadPlanUI();
    loadDraftList();
    pfRoundUIRefresh();
}

// Starts the server draft every speech endpoint writes into. All callers
// share one in-flight attempt; a failed attempt clears the slot so the next
// speech action can retry. Resolves with the draft id.
var __serverDraftPromise = null;

function ensureServerDraft() {
    if (window.__pfServerDraft && window.__currentRoundId) {
        return Promise.resolve(window.__currentRoundId);
    }
    if (__serverDraftPromise) return __serverDraftPromise;
    if (typeof window.pfRoundStart !== 'function') {
        return Promise.reject(new Error('round start unavailable'));
    }
    var side = document.getElementById('selectedSide').textContent;
    var turn = document.getElementById('selectedTurn').textContent;
    var skill = document.getElementById('selectedSkill').textContent;
    __serverDraftPromise = pfRoundStart({ topic: getDebateTopicSafe(), side: side, turn: turn, skill: skill },
        { page: 'Flow', quiet: true })
        .then(function (res) {
            if (!res || !res.id) throw new Error('round start returned no id');
            window.__currentRoundId = res.id;
            window.__pfServerDraft = true;
            if (res.doc && res.doc.evidenceMode) window.__pfEvidenceMode = res.doc.evidenceMode;
            saveRound();
            try {
                var u = new URL(location.href);
                u.searchParams.set('round', res.id);
                history.replaceState(null, '', u);
            } catch (e) { }
            loadDraftList();
            return res.id;
        })
        .catch(function (e) {
            __serverDraftPromise = null;
            throw e;
        });
    return __serverDraftPromise;
}

// Every speech action runs through this gate: without a server draft the
// speech endpoints have nothing to write into, so the mic must not open and
// no generation or judging may fire. A 402 already showed the upsell from
// pfFetch; only the failures ensureServerDraft's quiet flag suppressed
// (network, generic server error) get a toast here, so exactly one shows.
async function pfRequireServerDraft() {
    try {
        await ensureServerDraft();
        return true;
    } catch (e) {
        var surfaced = e && e.code && e.code !== 'network' && e.code !== 'http_error';
        if (!surfaced && window.pfToast) {
            pfToast('This round could not be started on the server. Check your connection and try again.', { kind: 'error' });
        }
        return false;
    }
}

// Overlay the server draft onto the page. Local HTML wins where it exists
// (it was pfSanitize output when saved); server strings fill the gaps and
// are sanitized again on render.
function applyServerRound(doc, selectedSide, nonselectedSide) {
    if (!doc || typeof doc !== 'object') return;
    function renderInto(elId, raw) {
        var el = document.getElementById(elId);
        if (!el) return;
        if (el.innerHTML === '' && typeof raw === 'string' && raw.trim() !== '') {
            el.innerHTML = '<p>' + pfSanitize(raw) + '</p>';
        }
    }
    if (typeof doc.transcription === 'string' && doc.transcription) fullTranscriptionContention = doc.transcription;
    if (typeof doc.transcriptionR === 'string' && doc.transcriptionR) fullTranscriptionRebuttal = doc.transcriptionR;
    if (typeof doc.transcriptionS === 'string' && doc.transcriptionS) fullTranscriptionSummary = doc.transcriptionS;
    if (typeof doc.transcriptionF === 'string' && doc.transcriptionF) fullTranscriptionFF = doc.transcriptionF;

    renderInto('AIContentionText', doc.AICase);
    renderInto('AIRebuttalText', doc.AIRebuttal);
    renderInto('AISummaryText', doc.AISummary);
    renderInto('AIFFText', doc.AIFinalFocus);

    // The server never sees the rendered flow HTML, only the transcripts, so
    // on a device without the local save the user's cells fall back to the
    // stored transcript (round.html does the same for saved rounds). Local
    // rendered flow HTML still wins: renderInto only fills empty cells.
    renderInto('transcriptionContentionText', doc.transcription);
    renderInto('transcriptionRebuttalText', doc.transcriptionR);
    renderInto('SummaryUserText', doc.transcriptionS);
    renderInto('FFUserText', doc.transcriptionF);

    if (doc.judgeType === 'tech' || doc.judgeType === 'lay') selectJudgeType(doc.judgeType);

    var feed = document.getElementById('feedback-content');
    if (feed && feed.textContent.trim() === '' && typeof doc.feedback === 'string' && doc.feedback.trim() !== '') {
        var html = pfSanitize(doc.feedback);
        if ((doc.judgeType || judgeType) === 'tech') html = html.replace('Decision:', '<br>Decision:');
        feed.innerHTML = '<p>' + html + '</p>';
        pfShowBallotLink();
    }
    if (doc.evidenceMode) window.__pfEvidenceMode = doc.evidenceMode;

    saveRound();
    updateResultsVisibility();
    pfRoundUIRefresh();
}

// Plan-aware chrome: quota label, simulated-evidence note, lock badges.
// Client gates are UX only; the server enforces every one of them.
function loadPlanUI() {
    if (typeof window.pfMe !== 'function') return;
    pfMe().then(function (me) {
        if (!me) return;
        window.__pfPlan = me.plan === 'premium' ? 'premium' : 'free';
        var quota = document.getElementById('switchQuota');
        if (quota) {
            if (window.__pfPlan === 'premium') {
                quota.textContent = 'Unlimited';
            } else {
                var used = (me.usage && me.usage.roundsStarted) || 0;
                var cap = (me.limits && me.limits.roundsPerMonth) || 3;
                quota.textContent = used + ' of ' + cap + ' this month';
            }
        }
        var note = document.getElementById('evidenceNote');
        if (note) note.hidden = window.__pfPlan !== 'free';
        pfRoundUIRefresh();
    }).catch(function () { /* plan stays unknown; server still enforces */ });
}

// Other unfinished rounds, one click away in the Settings dropdown. The
// summaries lack the skill setting, so switching fetches the full draft
// first and navigates with the complete parameter set.
function loadDraftList() {
    if (typeof window.pfRounds !== 'function') return;
    pfRounds({ page: 'Flow', quiet: true }).then(function (data) {
        var rounds = (data && data.rounds) || (Array.isArray(data) ? data : []);
        var drafts = rounds.filter(function (r) {
            return r && r.status === 'draft' && r.id && r.id !== window.__currentRoundId;
        });
        var section = document.getElementById('switchRoundSec');
        var list = document.getElementById('draftList');
        if (!section || !list) return;
        list.textContent = '';
        if (!drafts.length) { section.hidden = true; return; }
        drafts.forEach(function (d) {
            var item = document.createElement('a');
            item.className = 'draft-item';
            item.href = '#';
            var topic = document.createElement('span');
            topic.className = 'draft-topic';
            topic.textContent = d.topic || 'Practice Round';
            var meta = document.createElement('span');
            meta.className = 'draft-meta';
            var bar = document.createElement('span');
            bar.className = 'draft-bar';
            var fill = document.createElement('span');
            var done = typeof d.speechesDone === 'number' ? d.speechesDone : 0;
            fill.style.width = Math.round((done / 8) * 100) + '%';
            bar.appendChild(fill);
            var count = document.createElement('span');
            count.className = 'draft-count';
            count.textContent = done + '/8';
            meta.appendChild(bar);
            meta.appendChild(count);
            item.appendChild(topic);
            item.appendChild(meta);
            item.addEventListener('click', function (ev) {
                ev.preventDefault();
                pfRound(d.id, { page: 'Flow' }).then(function (doc) {
                    var qs = new URLSearchParams({
                        round: d.id,
                        debateTopic: (doc && doc.topic) || d.topic || '',
                        selectedSide: (doc && doc.side) || d.side || '',
                        selectedTurn: (doc && doc.turn) || d.turn || '',
                        selectedSkill: (doc && doc.skill) || ''
                    });
                    location.href = 'Flow.html?' + qs.toString();
                }).catch(function () {
                    if (window.pfToast) pfToast('Could not open that round. Please try again.', { kind: 'error' });
                });
            });
            list.appendChild(item);
        });
        section.hidden = false;
    }).catch(function () { /* the dropdown just has no Switch round section */ });
}

function restoreSavedRound(selectedSide, nonselectedSide, expectedId) {
    const savedState = localStorage.getItem(__savedRoundKey);
    if (!savedState) return; // No saved data

    let state;
    try { state = JSON.parse(savedState); } catch (e) { return; }

    // Arriving with a server draft id: the local copy only applies when it is
    // the same round. A different id on the same settings is a different
    // draft, and mixing the two would show one round's flows over another's.
    if (expectedId && state.roundId && state.roundId !== expectedId) return;

    // Restore text content
    document.getElementById('AIContentionText').innerHTML = state.AICase || '';
    document.getElementById('AIRebuttalText').innerHTML = state.AIRebuttal || '';
    document.getElementById('AISummaryText').innerHTML = state.AISummary || '';
    document.getElementById('AIFFText').innerHTML = state.AIFF || '';

    // Restore flow content
    transcriptionResultC.innerHTML = state.ContentionFlow || '';
    transcriptionResultR.innerHTML = state.RebuttalFlow || '';
    transcriptionResultS.innerHTML = state.SummaryFlow || '';
    transcriptionResultF.innerHTML = state.FFFlow || '';

    // Restore full transcriptions
    fullTranscriptionContention = state.transcriptionC || '';
    fullTranscriptionRebuttal = state.transcriptionR || '';
    fullTranscriptionSummary = state.transcriptionS || '';
    fullTranscriptionFF = state.transcriptionF || '';

    document.getElementById('feedback-content').innerHTML = state.feedback || '';

    // Restore turn progress
    if (typeof state.toggle === 'boolean') {
        ToggleisSelectedSide = state.toggle;
        toggleFlowButton.textContent = 'Toggle ' + (ToggleisSelectedSide ? nonselectedSide : selectedSide);
        updateFlowValues(selectedSide, nonselectedSide);
    }
    __roundSavedToProfile = !!state.savedToProfile;
    // Reusing the saved id keeps one round identity across reloads, so feedback
    // updates the right round and the server gem award stays deduplicated.
    if (state.roundId && !window.__currentRoundId) window.__currentRoundId = state.roundId;

    if (state.judgeType === 'tech' || state.judgeType === 'lay') selectJudgeType(state.judgeType);
    // textContent, not innerHTML: old saves may carry a stray HTML comment.
    if (document.getElementById('feedback-content').textContent.trim() !== '') pfShowBallotLink();

    updateResultsVisibility()
    // Resume recomputes the glow from the restored state; the old page left
    // the initial turn-based glow in place, which pointed at the wrong speech.
    pfRoundUIRefresh();
    console.log('Round auto-loaded!');
}
AISummaryGenerateB.addEventListener('click', async () => {
    if (!isSummarying) {
        if (pfRedoBlocked('ai', 2)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal;
        const transcriptionS = fullTranscriptionSummary;
        const AICase = document.getElementById('AIContentionText').innerHTML
        const AIRebuttal = document.getElementById('AIRebuttalText').innerHTML
        GenerateAISummary(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal);
        AISummaryGenerateB.textContent = 'Stop'; // Change button text to "Stop"
        isSummarying = true;
    } else {
        stopGeneratingAISummary();
        AISummaryGenerateB.textContent = 'Generate'; // Change button text back to "generate"
        isSummarying = false;
    }
});
AISummarySpeakB.addEventListener('click', async () => {
    if (!isSpeakingS) {
        if (pfIsFree()) { if (window.pfUpsell) pfUpsell('speak'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        AISummarySpeakB.textContent = 'Stop';
        startSpeakingS();
    } else {
        AISummarySpeakB.textContent = 'Speak';
        stopSpeakingS();
    }


});
AIFFGenerateB.addEventListener('click', async () => {
    if (!isFFing) {
        if (pfRedoBlocked('my', 3)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal;
        const transcriptionS = fullTranscriptionSummary;
        const AICase = document.getElementById('AIContentionText').innerHTML
        const AIRebuttal = document.getElementById('AIRebuttalText').innerHTML
        const AISummary = document.getElementById('AISummaryText').innerHTML
        GenerateAIFF(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal, AISummary);
        AIFFGenerateB.textContent = 'Stop'; // Change button text to "Stop"
        isFFing = true;
    } else {
        stopGeneratingAIFF();
        AIFFGenerateB.textContent = 'Generate'; // Change button text back to "generate"
        isFFing = false;
    }
});
AIFFSpeakB.addEventListener('click', async () => {
    if (!isSpeakingF) {
        if (pfIsFree()) { if (window.pfUpsell) pfUpsell('speak'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        AIFFSpeakB.textContent = 'Stop';
        startSpeakingF();
    } else {
        AIFFSpeakB.textContent = 'Speak';
        stopSpeakingF();
    }


});
generateButtonAI.addEventListener('click', async () => {
    if (!isGenerating) {
        if (pfRedoBlocked('ai', 0)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const selectedSkill = document.getElementById('selectedSkill').textContent;
        startGenerating(debateTopic, nonselectedSide, selectedSkill);
        generateButtonAI.textContent = 'Stop'; // Change button text to "Stop"
        isGenerating = true;
    } else {
        stopGenerating();
        generateButtonAI.textContent = 'Generate'; // Change button text back to "generate"
        isGenerating = false;
    }
});
GenerateAIRebuttalB.addEventListener('click', async () => {
    if (!isRebutting) {
        if (pfRedoBlocked('my', 1)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal;
        const selectedSkill = document.getElementById('selectedSkill').textContent;
        GenerateAIRebuttal(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, selectedSkill);
        GenerateAIRebuttalB.textContent = 'Stop'; // Change button text to "Stop"
        isRebutting = true;
    } else {
        stopGeneratingAIRebuttal();
        GenerateAIRebuttalB.textContent = 'Generate'; // Change button text back to "Speak"
        isRebutting = false;
    }
});
speakButtonAI.addEventListener('click', async () => {
    if (!isSpeaking) {
        if (pfIsFree()) { if (window.pfUpsell) pfUpsell('speak'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        speakButtonAI.textContent = 'Stop';
        startSpeaking();
    } else {
        speakButtonAI.textContent = 'Speak';
        stopSpeaking();
    }


});
AIRebuttalButton.addEventListener('click', async () => {
    if (!isSpeakingR) {
        if (pfIsFree()) { if (window.pfUpsell) pfUpsell('speak'); return; }
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        AIRebuttalButton.textContent = 'Stop';
        startSpeakingR();
    } else {
        AIRebuttalButton.textContent = 'Speak';
        stopSpeakingR();
    }


});
async function startSpeaking() {
    if (!isSpeaking) {
        await speakFromElement('AIContentionText', () => isSpeaking, playAudioQueue);
    }
}


// One /tts call covers a whole speech; only text past the 6,000-char cap
// gets a second chunk.
function splitForTTS(text) {
    const MAX = 6000;
    const chunks = [];
    let rest = text;
    while (rest.length > MAX) {
        let cut = rest.lastIndexOf('. ', MAX);
        if (cut < MAX / 2) cut = rest.lastIndexOf(' ', MAX);
        if (cut <= 0) cut = MAX;
        else cut += 1;
        // A boundary found at MAX becomes MAX + 1 above, one over the cap the
        // backend enforces, so clamp after the increment.
        if (cut > MAX) cut = MAX;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.trim() !== '') chunks.push(rest);
    return chunks;
}


async function speakFromElement(elementId, isActive, playQueue) {
    let text = document.getElementById(elementId).textContent;
    text = text.replace(/\[\d+\]/g, '');


    // Remove "Sources:" and everything that follows (works across multiple lines)
    text = text.replace(/Sources:[\s\S]*$/, '');
    const chunks = splitForTTS(text);
    const audioQueue = [];


    for (const chunk of chunks) {
        const url = await fetchAudioFromServer(chunk);
        if (url) audioQueue.push(url);


        // Start playing if queue has audio
        if (audioQueue.length > 0 && !isActive()) {
            playQueue(audioQueue);
        }

        // A failed chunk means the rest of the speech would fail the same way,
        // so stop instead of firing a toast per chunk.
        if (!url) break;
    }
}


async function fetchAudioFromServer(text) {
    // No client-side retry: the /tts limit is a rolling hour, so retry_after is
    // measured in tens of minutes and every retry would fail. api.js shows the
    // cooldown toast with the real wait instead.
    try {
        const response = await pfFetch('/tts', {
            json: {
                input: { text: text },
                voice: {
                    languageCode: "en-US",
                    name: "en-US-Chirp3-HD-Orus"
                },
                audioConfig: {
                    audioEncoding: "LINEAR16",
                    pitch: 0,
                    speakingRate: 1.19,
                    effectsProfileId: ["small-bluetooth-speaker-class-device"]
                }
            }
        }, { page: 'Flow' });

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("TTS error:", error);
        return null;
    }
}


function playAudioQueue(queue) {
    if (queue.length === 0) return;
    isSpeaking = true;


    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();


    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueue(queue);
        } else {
            isSpeaking = false;
            window.currentAudio = null;
        }
    };
}
function playAudioQueueR(queue) {
    if (queue.length === 0) return;
    isSpeakingR = true;


    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();


    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueueR(queue);
        } else {
            isSpeakingR = false;
            window.currentAudio = null;
        }
    };
}
function playAudioQueueS(queue) {
    if (queue.length === 0) return;
    isSpeakingS = true;


    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();


    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueueS(queue);
        } else {
            isSpeakingS = false;
            window.currentAudio = null;
        }
    };
}
function playAudioQueueF(queue) {
    if (queue.length === 0) return;
    isSpeakingF = true;


    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();


    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueueF(queue);
        } else {
            isSpeakingF = false;
            window.currentAudio = null;
        }
    };
}


function stopSpeaking() {
    isSpeaking = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }
}
function stopGenerating() {


}
function stopGeneratingAIRebuttal() {


}
function stopSpeakingR() {
    isSpeakingR = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }


}
function stopSpeakingS() {
    isSpeakingS = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }


}
function stopSpeakingF() {
    isSpeakingF = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }


}


async function startSpeakingR() {
    if (!isSpeakingR) {
        await speakFromElement('AIRebuttalText', () => isSpeakingR, playAudioQueueR);
    }
}
async function startGenerating(debateTopic, nonselectedSide, selectedSkill) {
    fullAIContentionRaw = '';
    const caseElement = document.getElementById('AIContentionText');
    const previousCase = caseElement.innerHTML;
    let caseGenerated = false;
    let sourcesStage = false;
    caseElement.innerHTML = '';
    pfCellBusy('ai', 0, 'generating');
    document.querySelector('#AIContention .loading').style.display = 'block';
    // Update text within AIContention's loading
    document.querySelector('#AIContention .text10').textContent = 'Generating Case (~15s)';


    try {
        // First API call to generate AI case
        const response1 = await pfFetch('/generate_ai_case', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                nonselectedSide: nonselectedSide,
                selectedSkill: selectedSkill
            })
        }, { page: 'Flow', button: generateButtonAI, label: 'Generate', recoverable: true });


        const data1 = await response1.json();
        const AICase = data1.AICase;

        // Show the case as soon as it exists. /get_sources replaces it below
        // when it works; when it fails the student still has the case that was
        // generated for them. The evidence markers and bold markup that
        // /get_sources would have stripped are stripped here too, because this
        // text is what the judge reads back off the page.
        if (typeof AICase === 'string' && AICase.trim() !== '') {
            caseGenerated = true;
            const plainCase = AICase.replace(/µ/g, '').replace(/\*\*/g, '');
            caseElement.innerHTML = "<p>" + pfSanitize(plainCase) + "</p>";
        }

        // Real sources are a Premium feature; free rounds run on simulated
        // evidence and never call /get_sources (the server rejects it anyway).
        const wantSources = window.__pfPlan === 'premium' && window.__pfEvidenceMode !== 'simulated';
        if (wantSources) {
            sourcesStage = true;
            // Update loading text
            document.querySelector('#AIContention .text10').textContent = 'Finding Sources (~10s)';


            // Second API call to get sources
            const response2 = await pfFetch('/get_sources', {
                json: pfWithRoundId({
                    AICase: AICase
                })
            }, { page: 'Flow', button: generateButtonAI, label: 'Generate', recoverable: true });


            const data2 = await response2.json();
            const modifiedAICase = data2.AICase;


            // Display the AI case with sources, keeping the sourceless one if the
            // sourced version came back empty.
            if (typeof modifiedAICase === 'string' && modifiedAICase.trim() !== '') {
                caseElement.innerHTML = "<p>" + pfSanitize(modifiedAICase) + "</p>";
            }
        }
    } catch (error) {
        console.error('Error processing user input:', error);
        // Both calls write the same slot, so one recovery covers either one
        // timing out: /generate_ai_case leaves the plain case there and
        // /get_sources overwrites it with the sourced version.
        const staleCase = caseElement.innerHTML;
        const renderCase = function (value) {
            return '<p>' + pfSanitize(value.replace(/µ/g, '').replace(/\*\*/g, '')) + '</p>';
        };
        // /get_sources answers 502 itself when Perplexity fails, and that
        // request is over: nothing will land in the slot, so waiting on it
        // only holds the student for minutes before the same outcome. Heroku's
        // own timeout is a 503, which still goes through recovery.
        const sourcesFailedOutright = sourcesStage && error && error.status === 502;
        const recovered = !sourcesFailedOutright && await pfRecoverAfterTimeout(error, {
            field: 'AICase',
            // When /get_sources is the call that timed out, the plain case is
            // already on screen and in the slot, so "answered" means the slot
            // renders to something other than what is showing: the sourced
            // version landing is the whole point of waiting.
            isReady: function (doc) {
                var value = doc.AICase;
                return typeof value === 'string' && value.trim() !== '' && renderCase(value) !== staleCase;
            },
            setWait: function () {
                document.querySelector('#AIContention .text10').textContent = 'Still writing, hold on';
            },
            apply: function (value) {
                caseGenerated = true;
                caseElement.innerHTML = renderCase(value);
            }
        });
        if (!recovered) {
            if (!caseGenerated) {
                caseElement.innerHTML = previousCase;
            } else if (window.pfToast) {
                pfToast('Your case is ready, but sources could not be attached this time. It will argue the same points with no citations behind them.', { duration: 9000 });
            }
        }
    } finally {
        // Hide the loading animation and reset UI elements
        document.querySelector('#AIContention .loading').style.display = 'none';
        generateButtonAI.textContent = 'Generate';
        isGenerating = false;
        saveRound()
        pfCellIdle('ai', 0);
    }
}


toggleFlowButton.addEventListener('click', () => {
    const selectedSide = document.getElementById('selectedSide').textContent;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';

    if (!ToggleisSelectedSide) {
        toggleFlowButton.textContent = 'Toggle ' + nonselectedSide;
        ToggleisSelectedSide = true;
    } else {
        toggleFlowButton.textContent = 'Toggle ' + selectedSide;
        ToggleisSelectedSide = false;
    }
    updateFlowValues(selectedSide, nonselectedSide);
    saveRound();
});
function updateFlowValues(selectedSide, nonselectedSide) {
    const flow1 = document.getElementById('Flow1');
    // The bar title names the sheet on screen and takes its color from whose
    // sheet it is, not from the side. The design hardcoded Aff blue / Neg red,
    // which reads correctly only for an Aff user; for a Neg user it would
    // paint their own sheet in the page's AI color while every cell on it is
    // blue. Owner-keyed matches the design exactly whenever the user is Aff.
    const visibleSide = ToggleisSelectedSide ? selectedSide : nonselectedSide;
    flow1.textContent = pfFullSide(visibleSide) + ' Flow';
    flow1.style.color = ToggleisSelectedSide ? 'var(--pf-accent)' : 'var(--pf-ai)';

    // Only the Case columns name a side, and those never change: the user's
    // case is always their side, the AI's case always the other. (Two spans
    // share the #Flow2 id; querying within each column reaches both.)
    document.getElementById('transcriptionContention').querySelector('#Flow2').textContent = selectedSide;
    document.getElementById('AIContention').querySelector('#Flow2').textContent = nonselectedSide;

    if (ToggleisSelectedSide) {
        UserFlowDiv.style.display = 'flex'; // Show the user's sheet
        AIFlowDiv.style.display = 'none';
    } else {
        UserFlowDiv.style.display = 'none'; // Hide the user's sheet
        AIFlowDiv.style.display = 'flex';
    }
    pfRoundUIRefresh();
}
recordButtonC.addEventListener('click', async () => {
    if (!isRecordingC) { // If not currently recording, start recording
        if (pfRedoBlocked('my', 0)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (!(await pfGateOrLogin({ page: 'Flow' }))) return;
        // No server draft means /processC has nowhere to write; the mic must
        // not even prompt for permission in that case.
        if (!(await pfRequireServerDraft())) return;
        startRecording();
        recordButtonC.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingC = true;
    } else { // If currently recording, stop recording
        stopRecording();
        recordButtonC.textContent = 'Record'; // Change button text back to "Record"
        isRecordingC = false;
        transcriptionResultC.textContent = '';
    }
});
recordButtonR.addEventListener('click', async () => {
    if (!isRecordingR) { // If not currently recording, start recording
        if (pfRedoBlocked('ai', 1)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (!(await pfGateOrLogin({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        startRecordingR();
        recordButtonR.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingR = true;
    } else { // If currently recording, stop recording
        stopRecordingR();
        recordButtonR.textContent = 'Record'; // Change button text back to "Record"
        isRecordingR = false;
        transcriptionResultR.textContent = '';
    }
});
recordButtonS.addEventListener('click', async () => {
    if (!isRecordingS) { // If not currently recording, start recording
        if (pfRedoBlocked('my', 2)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (!(await pfGateOrLogin({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        startRecordingS();
        recordButtonS.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingS = true;
    } else { // If currently recording, stop recording
        stopRecordingS();
        recordButtonS.textContent = 'Record'; // Change button text back to "Record"
        isRecordingS = false;
        transcriptionResultS.textContent = '';
    }
});
recordButtonF.addEventListener('click', async () => {
    if (!isRecordingF) { // If not currently recording, start recording
        if (pfRedoBlocked('ai', 3)) { if (window.pfUpsell) pfUpsell('redo'); return; }
        if (!(await pfGateOrLogin({ page: 'Flow' }))) return;
        if (!(await pfRequireServerDraft())) return;
        startRecordingF();
        recordButtonF.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingF = true;
    } else { // If currently recording, stop recording
        stopRecordingF();
        recordButtonF.textContent = 'Record'; // Change button text back to "Record"
        isRecordingF = false;
        transcriptionResultF.textContent = '';
    }
});
async function startRecording() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionContention = '';
    transcriptionResultC.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const flowCol = canvas.closest('.flow-col');
    canvas.width = flowCol ? Math.max(flowCol.clientWidth - 28, 120) : 300;
    canvas.height = 120;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Mark the cell as listening; the border tint and glow follow.
        pfCellBusy('my', 0, 'listening');


        // Visualization animation
        function draw() {
            animationFrame = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = canvas.height / 2;


            // Right side visualization
            let xRight = canvas.width / 2 + 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();

        // Show listening animation
        document.querySelector('.listeningC').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Mic denied or unavailable: drop the listening state again.
        pfClearListening();
    }
}
async function startRecordingR() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionRebuttal = '';
    transcriptionResultR.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer1');
    const ctx = canvas.getContext('2d');
    const flowCol = canvas.closest('.flow-col');
    canvas.width = flowCol ? Math.max(flowCol.clientWidth - 28, 120) : 300;
    canvas.height = 120;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Mark the cell as listening; the border tint and glow follow.
        pfCellBusy('ai', 1, 'listening');


        // Visualization animation
        function draw() {
            animationFrame = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = canvas.height / 2;


            // Right side visualization
            let xRight = canvas.width / 2 + 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();


        // Show listening animation
        document.querySelector('.listeningR').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Mic denied or unavailable: drop the listening state again.
        pfClearListening();
    }
}
async function startRecordingS() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionSummary = '';
    transcriptionResultS.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer2');
    const ctx = canvas.getContext('2d');
    const flowCol = canvas.closest('.flow-col');
    canvas.width = flowCol ? Math.max(flowCol.clientWidth - 28, 120) : 300;
    canvas.height = 120;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Mark the cell as listening; the border tint and glow follow.
        pfCellBusy('my', 2, 'listening');


        // Visualization animation
        function draw() {
            animationFrame = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = canvas.height / 2;


            // Right side visualization
            let xRight = canvas.width / 2 + 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();


        // Show listening animation
        document.querySelector('.listeningS').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Mic denied or unavailable: drop the listening state again.
        pfClearListening();
    }
}


async function startRecordingF() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionFF = '';
    transcriptionResultF.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer3');
    const ctx = canvas.getContext('2d');
    const flowCol = canvas.closest('.flow-col');
    canvas.width = flowCol ? Math.max(flowCol.clientWidth - 28, 120) : 300;
    canvas.height = 120;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Mark the cell as listening; the border tint and glow follow.
        pfCellBusy('ai', 3, 'listening');


        // Visualization animation
        function draw() {
            animationFrame = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = canvas.height / 2;


            // Right side visualization
            let xRight = canvas.width / 2 + 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 2;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();


        // Show listening animation
        document.querySelector('.listeningF').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Mic denied or unavailable: drop the listening state again.
        pfClearListening();
    }
}


async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningC').style.display = 'none';

            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultC.innerHTML = 'Please record a full public forum debate case';
                pfCellIdle('my', 0);

                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }

            pfCellBusy('my', 0, 'generating');
            document.querySelector('.loading0U').style.display = 'block';
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            try {
                // Send to your backend endpoint instead of Deepgram directly
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');


                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonC, label: 'Record' });

                const { transcript } = await response.json();
                fullTranscriptionContention = transcript;
                // Rest of your existing processing code
                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscription(transcript, debateTopic, selectedSide);

            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading0U').style.display = 'none';
                pfCellIdle('my', 0);
            }

            audioStream.getTracks().forEach(track => track.stop());

        };
    }

}




async function stopRecordingR() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningR').style.display = 'none';


            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultR.innerHTML = 'Please record a full public forum debate rebuttal';
                saveRound()
                pfCellIdle('ai', 1);
                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }

            pfCellBusy('ai', 1, 'generating');
            document.querySelector('.loading1U').style.display = 'block';
            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });



            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');


                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonR, label: 'Record' });

                const { transcript } = await response.json();

                fullTranscriptionRebuttal = transcript;

                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscriptionR(transcript, debateTopic, selectedSide);
                saveRound()

            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading1U').style.display = 'none';
                pfCellIdle('ai', 1);
            }


            // Cleanup audio resources
            audioStream.getTracks().forEach(track => track.stop());
        };
    }
}
async function stopRecordingS() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningS').style.display = 'none';

            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultS.innerHTML = 'Please record a full public forum debate summary';
                saveRound()
                pfCellIdle('my', 2);
                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }

            pfCellBusy('my', 2, 'generating');
            document.querySelector('.loading2U').style.display = 'block';

            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });



            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');

                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonS, label: 'Record' });

                const { transcript } = await response.json();

                fullTranscriptionSummary = transcript;

                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscriptionS(transcript, debateTopic, selectedSide);
                saveRound()

            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading2U').style.display = 'none';
                pfCellIdle('my', 2);
            }


            // Cleanup audio resources
            audioStream.getTracks().forEach(track => track.stop());
        };
    }
}


async function stopRecordingF() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningF').style.display = 'none';
            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultF.innerHTML = 'Please record a full public forum debate final focus';
                saveRound()
                pfCellIdle('ai', 3);
                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }
            pfCellBusy('ai', 3, 'generating');
            document.querySelector('.loading3U').style.display = 'block';

            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });


            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');


                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonF, label: 'Record' });

                const { transcript } = await response.json();


                fullTranscriptionFF = transcript;
                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscriptionF(transcript, debateTopic, selectedSide);
                saveRound()

            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading3U').style.display = 'none';
                pfCellIdle('ai', 3);
            }


            // Cleanup audio resources
            audioStream.getTracks().forEach(track => track.stop());
        };
    }
}




async function processTranscription(transcription, debateTopic, selectedSide) {
    document.querySelector('.loading0U').style.display = 'none';
    document.querySelector('.loadingU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    try {
        const response = await pfFetch('/processC', {
            json: pfWithRoundId({
                transcription: transcription,
                debateTopic: debateTopic,
                selectedSide: selectedSide,
            })
        }, { page: 'Flow', recoverable: true });

        // Get the debate flow from the response
        const { CaseFlow } = await response.json(); // Parse JSON response
        // Update the display with the generated debate flow
        if (CaseFlow == '') {
            transcriptionResultC.innerHTML = 'Your speech does not resemble a public forum debate case.'
            // The server refused to flow this speech, so the slot is still
            // open; keeping the raw transcript would lock the free plan's
            // Record behind the redo gate with nothing saved.
            fullTranscriptionContention = '';
            saveRound()
            pfRoundUIRefresh()
        } else {
            transcriptionResultC.innerHTML = "<p>" + pfSanitize(CaseFlow) + "</p>";
            saveRound()
        }
    } catch (error) {
        console.error('Failed to process transcription:', error);
        // A gateway timeout usually did store the speech, so ask before
        // assuming the slot is empty.
        const recovered = await pfRecoverUserSpeech(error, 'transcription', 'transcriptionContentionText', transcription);
        if (!recovered) fullTranscriptionContention = '';
        saveRound()
        pfRoundUIRefresh()
    } finally {
        document.querySelector('.loadingU').style.display = 'none';
        pfCellIdle('my', 0);
    }
}

function processTranscriptionR(transcriptionR, debateTopic, selectedSide) {
    document.querySelector('.loading1U').style.display = 'none';
    document.querySelector('.loadingRU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    pfFetch('/processR', {
        json: pfWithRoundId({
            transcriptionR: transcriptionR,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        })
    }, { page: 'Flow', recoverable: true })
        .then(response => response.json()) // Parse JSON response
        .then(data => {


            // Get the debate flow from the response
            const { RebuttalFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow
            transcriptionResultR.innerHTML = "<p>" + pfSanitize(RebuttalFlow) + "</p>";
            saveRound()
        })
        .catch(async error => {
            console.error('Failed to process transcription:', error);
            // A gateway timeout usually did store the speech, so ask before
            // assuming the slot is empty.
            const recovered = await pfRecoverUserSpeech(error, 'transcriptionR', 'transcriptionRebuttalText', transcriptionR);
            if (!recovered) fullTranscriptionRebuttal = '';
            saveRound()
            pfRoundUIRefresh()
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingRU').style.display = 'none';
            pfCellIdle('ai', 1);
        });
}
function processTranscriptionS(transcriptionS, debateTopic, selectedSide) {
    document.querySelector('.loading2U').style.display = 'none';
    document.querySelector('.loadingSU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    pfFetch('/processS', {
        json: pfWithRoundId({
            transcriptionS: transcriptionS,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        })
    }, { page: 'Flow', recoverable: true })
        .then(response => response.json()) // Parse JSON response
        .then(data => {


            // Get the debate flow from the response
            const { SummaryFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow


            transcriptionResultS.innerHTML = "<p>" + pfSanitize(SummaryFlow) + "</p>";
            saveRound()

        })
        .catch(async error => {
            console.error('Failed to process transcription:', error);
            // A gateway timeout usually did store the speech, so ask before
            // assuming the slot is empty.
            const recovered = await pfRecoverUserSpeech(error, 'transcriptionS', 'SummaryUserText', transcriptionS);
            if (!recovered) fullTranscriptionSummary = '';
            saveRound()
            pfRoundUIRefresh()
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingSU').style.display = 'none';
            pfCellIdle('my', 2);
        });
}
function processTranscriptionF(transcriptionF, debateTopic, selectedSide) {
    document.querySelector('.loading3U').style.display = 'none';
    document.querySelector('.loadingFFU').style.display = 'block';
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    // Send the transcription to your Python backend for processing
    transcriptionResultF.textContent = '';
    pfFetch('/processF', {
        json: pfWithRoundId({
            transcriptionF: transcriptionF,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        })
    }, { page: 'Flow', recoverable: true })
        .then(response => response.json()) // Parse JSON response
        .then(data => {


            // Get the debate flow from the response
            const { FinalFocusFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow


            transcriptionResultF.innerHTML = "<p>" + pfSanitize(FinalFocusFlow) + "</p>";
            saveRound()
        })
        .catch(async error => {
            console.error('Failed to process transcription:', error);
            // A gateway timeout usually did store the speech, so ask before
            // assuming the slot is empty.
            const recovered = await pfRecoverUserSpeech(error, 'transcriptionF', 'FFUserText', transcriptionF);
            if (!recovered) fullTranscriptionFF = '';
            saveRound()
            pfRoundUIRefresh()
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingFFU').style.display = 'none';

            // Results-visibility timing asymmetry is intentional: when the
            // user speaks Second their FF flow is the round's last render.
            if (selectedTurn == 'Second') {
                updateResultsVisibility()
            }
            saveRound()
            pfCellIdle('ai', 3);
        });
}
function GenerateAIRebuttal(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, selectedSkill) {
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    fullAIRebuttal = ''; // Reset full AI rebuttal
    pfCellBusy('my', 1, 'generating');
    document.querySelector('.loadingRA').style.display = 'block';
    // Get the user's input from the text box
    // Send the user's input to the Python backend for processing
    if (selectedTurn == "First") {
        pfFetch('/secondrebuttal', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                selectedSkill: selectedSkill
            })
        }, { page: 'Flow', button: GenerateAIRebuttalB, label: 'Generate', recoverable: true })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AISecondRebuttal } = data;
                // Display the AI response
                document.getElementById('AIRebuttalText').innerHTML = "<p>" + pfSanitize(AISecondRebuttal) + "</p>";


            })
            .catch(async error => {
                console.error('Error processing user input:', error);
                await pfRecoverAiSpeech(error, 'AIRebuttal', 'AIRebuttalText');
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingRA').style.display = 'none';
                GenerateAIRebuttalB.textContent = 'Generate';
                isRebutting = false;
                saveRound()
                pfCellIdle('my', 1);
            });
    }
    if (selectedTurn == "Second") {
        pfFetch('/firstrebuttal', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
            })
        }, { page: 'Flow', button: GenerateAIRebuttalB, label: 'Generate', recoverable: true })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AIFirstRebuttal } = data;
                // Display the AI response
                document.getElementById('AIRebuttalText').innerHTML = "<p>" + pfSanitize(AIFirstRebuttal) + "</p>";


            })
            .catch(async error => {
                console.error('Error processing user input:', error);
                await pfRecoverAiSpeech(error, 'AIRebuttal', 'AIRebuttalText');
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingRA').style.display = 'none';
                GenerateAIRebuttalB.textContent = 'Generate';
                isRebutting = false;
                saveRound()
                pfCellIdle('my', 1);
            });
    }


}
function GenerateAISummary(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal) {
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    pfCellBusy('ai', 2, 'generating');
    document.querySelector('.loadingSA').style.display = 'block';
    // Get the user's input from the text box
    // Send the user's input to the Python backend for processing
    if (selectedTurn == "First") {
        pfFetch('/secondsummary', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                AICase: AICase,
                AIRebuttal: AIRebuttal


            })
        }, { page: 'Flow', button: AISummaryGenerateB, label: 'Generate', recoverable: true })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AISecondSummary } = data;
                // Display the AI response
                document.getElementById('AISummaryText').innerHTML = "<p>" + pfSanitize(AISecondSummary) + "</p>";


            })
            .catch(async error => {
                console.error('Error processing user input:', error);
                await pfRecoverAiSpeech(error, 'AISummary', 'AISummaryText');
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingSA').style.display = 'none';
                AISummaryGenerateB.textContent = 'Generate';
                isSummarying = false;
                saveRound()
                pfCellIdle('ai', 2);
            });
    }
    if (selectedTurn == "Second") {
        pfFetch('/firstsummary', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                AICase: AICase,
                AIRebuttal: AIRebuttal


            })
        }, { page: 'Flow', button: AISummaryGenerateB, label: 'Generate', recoverable: true })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AIFirstSummary } = data;
                // Display the AI response
                document.getElementById('AISummaryText').innerHTML = "<p>" + pfSanitize(AIFirstSummary) + "</p>";


            })
            .catch(async error => {
                console.error('Error processing user input:', error);
                await pfRecoverAiSpeech(error, 'AISummary', 'AISummaryText');
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingSA').style.display = 'none';
                AISummaryGenerateB.textContent = 'Generate';
                isSummarying = false;
                saveRound()
                pfCellIdle('ai', 2);
            });
    }


}
function GenerateAIFF(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal, AISummary) {
    pfCellBusy('my', 3, 'generating');
    document.querySelector('.loadingFFA').style.display = 'block';
    pfFetch('/finalfocus', {
        json: pfWithRoundId({
            debateTopic: debateTopic,
            selectedSide: selectedSide,
            nonselectedSide: nonselectedSide,
            transcription: transcription,
            transcriptionR: transcriptionR,
            transcriptionS: transcriptionS,
            AICase: AICase,
            AIRebuttal: AIRebuttal,
            AISummary: AISummary
        })
    }, { page: 'Flow', button: AIFFGenerateB, label: 'Generate', recoverable: true })
        .then(response => response.json()) // Parse JSON response
        .then(data => {
            // Get the AI response from the data
            const { AIFinalFocus } = data;




            // Display the AI response
            document.getElementById('AIFFText').innerHTML = "<p>" + pfSanitize(AIFinalFocus) + "</p>";
        })
        .catch(async error => {
            console.error('Error processing user input:', error);
            await pfRecoverAiSpeech(error, 'AIFinalFocus', 'AIFFText');
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingFFA').style.display = 'none';
            AIFFGenerateB.textContent = 'Generate';
            isFFing = false;
            const selectedTurn = document.getElementById('selectedTurn').textContent;
            saveRound()
            // Results-visibility timing asymmetry is intentional: when the
            // user speaks First, the AI's FF is the round's last render.
            if (selectedTurn != "Second") {
                updateResultsVisibility()
                saveRound()
            }
            pfCellIdle('my', 3);
        });
}
function stopGeneratingAISummary() {


}
function stopGeneratingAIFF() {


}


async function startSpeakingS() {
    if (!isSpeakingS) {
        await speakFromElement('AISummaryText', () => isSpeakingS, playAudioQueueS);
    }
}
async function startSpeakingF() {
    if (!isSpeakingF) {
        await speakFromElement('AIFFText', () => isSpeakingF, playAudioQueueF);
    }
}

function captureState() {
    const state = {
        // Save text content from boxes
        AICase: document.getElementById('AIContentionText').innerHTML,
        AIRebuttal: document.getElementById('AIRebuttalText').innerHTML,
        AISummary: document.getElementById('AISummaryText').innerHTML,
        AIFF: document.getElementById('AIFFText').innerHTML,
        ContentionFlow: transcriptionResultC.innerHTML,
        RebuttalFlow: transcriptionResultR.innerHTML,
        SummaryFlow: transcriptionResultS.innerHTML,
        FFFlow: transcriptionResultF.innerHTML,
        transcriptionC: fullTranscriptionContention,
        transcriptionR: fullTranscriptionRebuttal,
        transcriptionS: fullTranscriptionSummary,
        transcriptionF: fullTranscriptionFF,
        feedback: document.getElementById('feedback-content').innerHTML,
        toggle: ToggleisSelectedSide,
        savedToProfile: __roundSavedToProfile,
        skill: document.getElementById('selectedSkill')?.textContent?.trim() || '',
        judgeType: (typeof judgeType === 'string' && judgeType) ? judgeType : 'tech',
        updatedAt: Date.now(),
        roundId: window.__currentRoundId || null
    };
    return state;
}
function saveRound() {
    if (!__savedRoundKey) return; // No signed-in user resolved yet
    const state = captureState();
    localStorage.setItem(__savedRoundKey, JSON.stringify(state));
    // Speech content reaches the server through the speech endpoints (every
    // payload carries roundId); the debounced PATCH keeps judgeType in step.
    scheduleDraftPatch();
}
function clearSavedRound() {
    if (__savedRoundKey) localStorage.removeItem(__savedRoundKey);
    localStorage.removeItem('savedRound'); // Old single-key format
    __draftPatchDisabled = true;
    clearTimeout(__draftPatchTimer);

    // Delete the server draft too (best effort; quota is not refunded), then
    // send the user to set up their next round.
    var id = window.__currentRoundId;
    var done = function () { location.href = 'setup.html'; };
    if (id && typeof window.pfRoundDelete === 'function') {
        pfRoundDelete(id, { page: 'Flow', quiet: true, noUpsell: true }).then(done, done);
    } else {
        done();
    }
}

// Add to JavaScript
function openResultsModal() {
    document.getElementById('results-modal').style.display = 'block';
}

function closeResultsModal() {
    document.getElementById('results-modal').style.display = 'none';
}

function selectJudgeType(type) {
    if (['tech', 'lay'].includes(type)) {
        judgeType = type;

        document.querySelectorAll('.judge-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
        });
        saveRound();
    }

}
// The meta block every locally saved round carries. Kept in one place because
// saveFeedbackToProfile replaces meta wholesale when it patches a round.
function currentRoundMeta() {
  return {
    debateTopic: getDebateTopicSafe(),
    selectedSide: document.getElementById('selectedSide')?.textContent?.trim() || '',
    selectedTurn: document.getElementById('selectedTurn')?.textContent?.trim() || '',
    selectedSkill: document.getElementById('selectedSkill')?.textContent?.trim() || '',
    judgeType: (typeof judgeType !== 'undefined' ? judgeType : 'tech')
  };
}

// Map a locally saved round onto the flat shape POST /rounds accepts. The
// backend rejects an oversize field rather than truncating it, so the caps are
// applied here.
function toServerRound(round) {
  const SHORT = 100;
  const LONG = 60000;
  const text = (value, cap) => (typeof value === 'string' ? value.slice(0, cap) : '');
  const meta = round.meta || {};
  return {
    id: round.id,
    topic: text(meta.debateTopic, 500) || 'Practice Round',
    side: text(meta.selectedSide, SHORT),
    turn: text(meta.selectedTurn, SHORT),
    skill: text(meta.selectedSkill, SHORT),
    judgeType: text(meta.judgeType, SHORT),
    transcription: text(round.transcriptionC, LONG),
    transcriptionR: text(round.transcriptionR, LONG),
    transcriptionS: text(round.transcriptionS, LONG),
    transcriptionF: text(round.transcriptionF, LONG),
    AICase: text(round.AICase, LONG),
    AIRebuttal: text(round.AIRebuttal, LONG),
    AISummary: text(round.AISummary, LONG),
    AIFinalFocus: text(round.AIFF, LONG),
    feedback: text(round.Feedback || round.feedback, LONG)
  };
}

// Best-effort copy to the account. The round is already in localStorage, so a
// failure here costs the student nothing on this device. Server-draft rounds
// never take this path: their content is persisted by the speech endpoints,
// and a legacy full save would overwrite the draft's status and evidence
// mode with this page's rendered-HTML copies.
function syncRoundToServer(round) {
  if (window.__pfServerDraft) return;
  if (typeof window.pfFetch !== 'function') return;
  if (!round || !round.id) return;
  // Legacy full-save is for locally minted ids only. A server-issued id here
  // would mean POST /rounds replacing a draft document, which the backend now
  // refuses anyway.
  if (String(round.id).indexOf('r_') !== 0) return;
  try {
    pfFetch('/rounds', { json: toServerRound(round) }, { page: 'Flow', quiet: true })
      .catch(error => { console.error('Could not save this round to your account:', error); });
  } catch (error) {
    console.error('Could not save this round to your account:', error);
  }
}

function onResultsButtonShown(){
  if (__roundSavedToProfile) return;

  const user = (window.currentUser && window.currentUser()) || null;
  if (!user) return; // only save/award if logged in

  // Take a snapshot of the round at the moment Results become available
  const state = captureState(); // uses your existing function

  const round = {
    ...state,
    // Make sure we persist the topic + judge + quick meta for the profile card
    meta: currentRoundMeta(),
    // Keep the feedback HTML if it already exists in the DOM
    Feedback: document.getElementById('feedback-content')?.innerHTML || '',
    timestamp: Date.now()
  };

  // Save & award (reuse the round id the feedback call may have minted,
  // so the server-side gem award and this saved round share one key)
  round.id = pfCurrentRoundId();
  const id = (window.addRoundForUser && addRoundForUser(user.uid, round)) || null;
  if (id) window.__currentRoundId = id;
  // No local gem credit here. The server awards the round's gems once per round
  // id when the judge runs, and the profile reads that total, so crediting the
  // same round again on this device only makes the two disagree.

  __roundSavedToProfile = true;
  // Persist the id with the round state so a reload reuses it instead of
  // minting a new one.
  saveRound();
  syncRoundToServer(round);

  // (Optional) tiny visual cue on the button
  try { document.getElementById('results-btn')?.setAttribute('data-saved', '1'); } catch {}
}
// Update the saved profile round with feedback (no extra gems, no duplicates).
// Writes only to the round this page is running, and only once there is
// feedback to write: a missing id or empty feedback means there is nothing to
// save, never a licence to overwrite some other round.
function saveFeedbackToProfile() {
  try {
    const user = (window.currentUser && window.currentUser()) || null;
    if (!user) return;

    const id = window.__currentRoundId || null;
    if (!id) return;

    const feedbackHtml = document.getElementById('feedback-content')?.innerHTML || '';
    if (feedbackHtml.trim() === '') return;

    const patch = {
      Feedback: feedbackHtml,
      // keep judge + topic + quick meta in sync
      meta: currentRoundMeta()
    };

    const key = `pfai_profile::${user.uid}`;
    const profile = JSON.parse(localStorage.getItem(key) || '{"gems":0,"rounds":[]}');
    const rounds = profile.rounds || [];

    const idx = rounds.findIndex(r => r.id === id);
    if (idx < 0) return;
    rounds[idx] = { ...rounds[idx], ...patch };

    profile.rounds = rounds;
    localStorage.setItem(key, JSON.stringify(profile));
    syncRoundToServer(rounds[idx]);
  } catch (e) {
    console.error('saveFeedbackToProfile failed:', e);
  }
}

// The current round id, or null. Never mints one: the server rejects ids it
// did not issue, so ids only ever come from /rounds/start, ?round=, or a
// restored save.
function pfCurrentRoundId() {
  return window.__currentRoundId || null;
}

// The server draft id, or null when no server draft exists (a restored r_ id
// is local-only and must never be sent to the speech endpoints).
function pfServerRoundId() {
  return (window.__pfServerDraft && window.__currentRoundId) ? window.__currentRoundId : null;
}

// Attach roundId to a payload only when a server draft exists. Without one
// the key is omitted entirely: the backend treats a missing roundId as a
// standalone (flower-style) call, but a null one as a bad id.
function pfWithRoundId(json) {
  var id = pfServerRoundId();
  if (id) json.roundId = id;
  return json;
}

/* ===== Recovering work the gateway gave up on ===============================
   Heroku's router abandons a request after 30 seconds. The dyno does not: it
   finishes the generation and writes it into the draft round anyway. So a
   timeout is an answer this browser never got handed, not work that has to be
   paid for a second time. Every generate, flow and judge call sends its
   failure through here, which waits for the slot to fill and renders what the
   server actually produced.

   Two things this deliberately will not do. It never fires on a 500, because
   our own handler raising means it never reached the line that persists. And
   it never re-sends the request: a second call is a second bill, and on the
   free plan it would run straight into the server's redo gate against the
   speech the first call already stored. */
async function pfRecoverAfterTimeout(error, opts) {
  if (typeof window.pfMayStillBeRunning !== 'function' || !pfMayStillBeRunning(error)) return false;
  var id = pfServerRoundId();
  if (!id || typeof window.pfRecoverRound !== 'function') return false;

  var field = opts.field;
  // "Non-empty" is not good enough as a readiness test. On a premium redo the
  // slot still holds the previous speech, so the first poll would return that
  // and pass it off as the new one. Every caller therefore says what "new"
  // means for it, and the default only applies where the slot starts empty.
  var isReady = opts.isReady || function (doc) {
    return typeof doc[field] === 'string' && doc[field].trim() !== '';
  };

  var announced = false;
  var doc = await pfRecoverRound(id, isReady, {
    page: 'Flow',
    onWait: function () {
      if (announced) return;
      announced = true;
      if (opts.setWait) { try { opts.setWait(); } catch (e) {} }
      if (window.pfToast) {
        pfToast('This is taking longer than usual. It is still being written, and it will appear here by itself.', { duration: 9000 });
      }
    }
  });

  if (!doc) {
    if (window.pfToast) {
      pfToast('That did not come back in time. Nothing is lost: reopen this round in a minute and it will be here.', { kind: 'error', duration: 10000 });
    }
    return false;
  }
  opts.apply(doc[field], doc);
  return true;
}

// An AI speech. The cell still shows the previous speech at the moment the
// call fails, because nothing overwrote it, so that rendered string is exactly
// the "stale" value to hold the recovery against: the slot counts as answered
// only once it renders to something else.
// The ballot's rendered form, shared by the success path and the recovery so
// the two are compared like for like.
function pfJudgeHtml(feedback, judgeType) {
  var html = pfSanitize(feedback);
  // The tech ballot breaks the line before its verdict. The lay one has no
  // Decision line to break, so rendering it the same way would make a
  // recovered lay ballot differ from the one the success path draws.
  if (judgeType === 'tech') html = html.replace('Decision:', '<br>Decision:');
  return '<p>' + html + '</p>';
}

function pfRecoverAiSpeech(error, field, cellId, render) {
  var el = document.getElementById(cellId);
  var stale = el.innerHTML;
  render = render || function (value) { return '<p>' + pfSanitize(value) + '</p>'; };
  return pfRecoverAfterTimeout(error, {
    field: field,
    isReady: function (doc) {
      var value = doc[field];
      return typeof value === 'string' && value.trim() !== '' && render(value) !== stale;
    },
    apply: function (value) { el.innerHTML = render(value); }
  });
}

// A user speech. The readiness test is exact here: the slot is answered when
// it holds the transcript this attempt just sent, which a leftover speech from
// an earlier take cannot satisfy. The stored copy may be truncated to the
// server's cap, so a prefix counts.
//
// This is the one lossy recovery. The server keeps the raw transcript and
// never the flowed version the page renders, so a recovered user speech comes
// back as what they said rather than as the flow of it. Same fallback
// restoreSavedRound already uses on a second device.
function pfRecoverUserSpeech(error, field, cellId, sent) {
  return pfRecoverAfterTimeout(error, {
    field: field,
    isReady: function (doc) {
      var stored = doc[field];
      if (typeof stored !== 'string' || stored === '') return false;
      return typeof sent === 'string' && sent.indexOf(stored) === 0;
    },
    apply: function (value) {
      document.getElementById(cellId).innerHTML = '<p>' + pfSanitize(value) + '</p>';
    }
  });
}

function generateFeedback(judgeType, selectedTurn, debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, transcriptionF, AICase, AIRebuttal, AISummary, AIFinalFocus) {
    // Feedback already on the page is put back if this request fails, so a
    // rate-limited second opinion does not cost the student the first one.
    const previousFeedback = document.getElementById('feedback-content').innerHTML;
    document.getElementById('feedback-content').innerHTML = ''
    document.querySelector('.loadingfeed').style.display = 'block';
    if (judgeType == 'tech') {

        pfFetch('/tech', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                selectedTurn: selectedTurn,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                transcriptionF: transcriptionF,
                AICase: AICase,
                AIRebuttal: AIRebuttal,
                AISummary: AISummary,
                AIFinalFocus: AIFinalFocus
            })
        }, { page: 'Flow', button: generateFeedbackButton, recoverable: true })
            .then(response => response.json()) // Parse JSON response
            .then(data => {
                // Get the AI response from the data
                const { TechFeedback } = data;




                // Display the AI response

                document.getElementById('feedback-content').innerHTML = pfJudgeHtml(TechFeedback, 'tech');
                saveRound()
                saveFeedbackToProfile();
                pfShowBallotLink();
            })
            .catch(async error => {
                console.error('Error processing user input:', error);
                const recovered = await pfRecoverAfterTimeout(error, {
                    field: 'feedback',
                    isReady: function (doc) {
                        if (doc.status !== 'finished') return false;
                        if (typeof doc.feedback !== 'string' || doc.feedback.trim() === '') return false;
                        // A re-judge starts with the first ballot still stored,
                        // so the old verdict must not pass as the new one.
                        return pfJudgeHtml(doc.feedback, doc.judgeType) !== previousFeedback;
                    },
                    apply: function (value, doc) {
                        document.getElementById('feedback-content').innerHTML = pfJudgeHtml(value, doc.judgeType);
                        saveRound()
                        saveFeedbackToProfile();
                        pfShowBallotLink();
                    }
                });
                if (!recovered) document.getElementById('feedback-content').innerHTML = previousFeedback;
            })
            .finally(() => {
                document.querySelector('.loadingfeed').style.display = 'none';
            }
            );
    } else if (judgeType == 'lay') {
        pfFetch('/lay', {
            json: pfWithRoundId({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                selectedTurn: selectedTurn,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                transcriptionF: transcriptionF,
                AICase: AICase,
                AIRebuttal: AIRebuttal,
                AISummary: AISummary,
                AIFinalFocus: AIFinalFocus
            })
        }, { page: 'Flow', button: generateFeedbackButton, recoverable: true })
            .then(response => response.json()) // Parse JSON response
            .then(data => {
                // Get the AI response from the data
                const { LayFeedback } = data;




                // Display the AI response
                document.getElementById('feedback-content').innerHTML = pfJudgeHtml(LayFeedback, 'lay');
                saveRound()
                saveFeedbackToProfile();
                pfShowBallotLink();
            })
            .catch(async error => {
                console.error('Error processing user input:', error);
                const recovered = await pfRecoverAfterTimeout(error, {
                    field: 'feedback',
                    isReady: function (doc) {
                        if (doc.status !== 'finished') return false;
                        if (typeof doc.feedback !== 'string' || doc.feedback.trim() === '') return false;
                        // A re-judge starts with the first ballot still stored,
                        // so the old verdict must not pass as the new one.
                        return pfJudgeHtml(doc.feedback, doc.judgeType) !== previousFeedback;
                    },
                    apply: function (value, doc) {
                        document.getElementById('feedback-content').innerHTML = pfJudgeHtml(value, doc.judgeType);
                        saveRound()
                        saveFeedbackToProfile();
                        pfShowBallotLink();
                    }
                });
                if (!recovered) document.getElementById('feedback-content').innerHTML = previousFeedback;
            })
            .finally(() => {
                document.querySelector('.loadingfeed').style.display = 'none';
            }
            );
    }

}




generateFeedbackButton.addEventListener('click', async () => {
    if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
    if (!(await pfRequireServerDraft())) return;
    const selectedSide = document.getElementById('selectedSide').textContent;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
    const transcription = fullTranscriptionContention;
    const transcriptionR = fullTranscriptionRebuttal;
    const transcriptionS = fullTranscriptionSummary;
    const transcriptionF = fullTranscriptionFF;
    const AICase = document.getElementById('AIContentionText').innerHTML
    const AIRebuttal = document.getElementById('AIRebuttalText').innerHTML
    const AISummary = document.getElementById('AISummaryText').innerHTML
    const AIFF = document.getElementById('AIFFText').innerHTML
    judgeType = judgeType;
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    generateFeedback(judgeType, selectedTurn, debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, transcriptionF, AICase, AIRebuttal, AISummary, AIFF);


});

function toggleResultsButton(show) {
  const resultsBtn = document.getElementById('results-btn');
  const placeholder = document.getElementById('results-placeholder');

  if (show) {
    placeholder.classList.add('hidden');
    setTimeout(() => {
      resultsBtn.classList.add('visible');
    }, 50);
    // NEW: one-time profile save + 100 gems when Results first appear
    if (!__roundSavedToProfile) onResultsButtonShown();
  } else {
    resultsBtn.classList.remove('visible');
    setTimeout(() => {
      placeholder.classList.remove('hidden');
    }, 50);
  }
}


function downloadRoundAsPDF() {
    // Implement PDF generation using jsPDF or similar
    console.log('Downloading round as PDF...');
    // Example: 
    // const doc = new jsPDF();
    // doc.text('Round Transcript', 10, 10);
    // doc.save('debate-round.pdf');
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('results-modal');
    if (event.target === modal) {
        closeResultsModal();
    }
}

function updateResultsVisibility() {
    toggleResultsButton(checkRoundCompletion());
}

function checkRoundCompletion() {
    if (fullTranscriptionContention == '' || fullTranscriptionRebuttal == '' || fullTranscriptionSummary == '' || fullTranscriptionFF == '' || document.getElementById('AIContentionText').innerHTML == '' || document.getElementById('AIRebuttalText').innerHTML == '' || document.getElementById('AISummaryText').innerHTML == '' || document.getElementById('AIFFText').innerHTML == '') {
        roundOver = false;
        return false;
    } else {
        roundOver = true;
        return true;
    }

}
