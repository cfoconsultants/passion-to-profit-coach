import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { STAGES, PERSONA, FINAL_QUESTION, CALENDLY_URL, REPORT_SECTIONS } from '../lib/coachScript';
import { callClaude, delay } from '../lib/api';
import { generateRoadmapPdf } from '../lib/generatePdf';

const SESSION_KEY = 'ptp_session_v1';

export default function Home() {
  const [stageIndex, setStageIndex] = useState(0);
  const [mode, setMode] = useState('loading'); // loading | stage | final_question | ready | generating | report_error | report
  const [thread, setThread] = useState([]);
  const [stageSummaries, setStageSummaries] = useState([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportData, setReportData] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [readyError, setReadyError] = useState('');

  const historyRef = useRef([]);
  const threadEndRef = useRef(null);
  const loadedRef = useRef(false);

  // ---------- Load saved session on mount ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setStageIndex(saved.stageIndex ?? 0);
        setThread(saved.thread ?? []);
        setStageSummaries(saved.stageSummaries ?? []);
        setFinalAnswer(saved.finalAnswer ?? '');
        setReportName(saved.reportName ?? '');
        setReportData(saved.reportData ?? null);
        historyRef.current = saved.history ?? [];
        setMode(saved.mode ?? 'stage');
        loadedRef.current = true;
        return;
      }
    } catch (e) {
      console.warn('Could not load saved session:', e);
    }
    beginStage(0);
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Persist session on relevant changes ----------
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          stageIndex,
          mode,
          thread,
          stageSummaries,
          finalAnswer,
          reportName,
          reportData,
          history: historyRef.current,
        })
      );
    } catch (e) {
      console.warn('Could not save session progress:', e);
    }
  }, [stageIndex, mode, thread, stageSummaries, finalAnswer, reportName, reportData]);

  // ---------- Auto-scroll the chat thread ----------
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread, showTranscript]);

  function beginStage(index) {
    const stage = STAGES[index];
    historyRef.current = [{ role: 'assistant', content: JSON.stringify({ message: stage.opener, done: false }) }];
    setThread((prev) =>
      index === 0
        ? [{ type: 'msg', role: 'coach', text: stage.opener }]
        : [...prev, { type: 'divider', label: stage.label }, { type: 'msg', role: 'coach', text: stage.opener }]
    );
    setStageIndex(index);
    setMode('stage');
  }

  function beginFinalQuestion() {
    setThread((prev) => [
      ...prev,
      { type: 'divider', label: 'Anything Else?' },
      { type: 'msg', role: 'coach', text: FINAL_QUESTION },
    ]);
    setMode('final_question');
  }

  async function handleSend() {
    if (busy) return;
    const text = inputValue.trim();

    if (mode === 'final_question') {
      setThread((prev) => [...prev, { type: 'msg', role: 'user', text: text || '(nothing to add)' }]);
      if (text) setFinalAnswer(text);
      setInputValue('');
      setTimeout(() => setMode('ready'), 600);
      return;
    }

    if (!text) return;

    setThread((prev) => [...prev, { type: 'msg', role: 'user', text }]);
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];
    setInputValue('');
    setBusy(true);

    try {
      const stage = STAGES[stageIndex];
      const apiMessages = historyRef.current.map((h) => ({
        role: h.role,
        content: h.role === 'assistant' ? JSON.parse(h.content).message : h.content,
      }));
      const result = await callClaude(PERSONA + ' ' + stage.system, apiMessages);
      setThread((prev) => [...prev, { type: 'msg', role: 'coach', text: result.message }]);
      historyRef.current = [...historyRef.current, { role: 'assistant', content: JSON.stringify(result) }];

      if (result.done) {
        setStageSummaries((prev) => [...prev, { stage: stage.label, summary: result.message }]);
        const nextIndex = stageIndex + 1;
        setTimeout(() => {
          if (nextIndex < STAGES.length) {
            beginStage(nextIndex);
          } else {
            beginFinalQuestion();
          }
        }, 1400);
      }
    } catch (err) {
      setThread((prev) => [...prev, { type: 'error', text: 'Something went wrong reaching the AI coach. Please try again.' }]);
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleGenerate() {
    const name = reportName.trim();
    if (!name) {
      setReadyError('Please enter your name so we know who this Roadmap is for.');
      return;
    }
    setReadyError('');
    await generateReport(REPORT_SECTIONS);
  }

  async function generateReport(sections) {
    setMode('generating');
    const summaryParts = stageSummaries.map((s) => `${s.stage}: ${s.summary}`);
    if (finalAnswer) summaryParts.push(`Anything Else: ${finalAnswer}`);
    const summaryText = summaryParts.join('\n');

    const results = await Promise.allSettled(
      sections.map((s, i) => delay(i * 500).then(() => callClaude(s.system, [{ role: 'user', content: summaryText }])))
    );

    const merged = { user_name: reportName, ...(reportData || {}) };
    const failed = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        Object.assign(merged, res.value);
      } else {
        failed.push(sections[i]);
        console.error(`Report section "${sections[i].key}" failed:`, res.reason);
      }
    });

    setReportData(merged);

    if (failed.length > 0) {
      setSectionErrors(failed);
      setMode('report_error');
    } else {
      setSectionErrors([]);
      setMode('report');
    }
  }

  async function handleDownloadPdf() {
    if (!reportData) return;
    setPdfBusy(true);
    setPdfError('');
    try {
      await generateRoadmapPdf(reportData);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfError('Something went wrong generating the PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  }

  function handleStartOver() {
    if (confirm('This clears your saved progress and starts a fresh session. Continue?')) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      window.location.reload();
    }
  }

  const trackerLabels = STAGES.map((s) => s.label).concat(['Roadmap']);
  const trackerActiveIndex = mode === 'stage' || mode === 'final_question' ? stageIndex : STAGES.length;

  return (
    <>
      <Head>
        <title>Passion to Profit Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div className="app" style={{ position: 'relative' }}>
        <button className="ghost-btn no-print" style={{ position: 'absolute', top: 24, right: 20, fontSize: 11, padding: '5px 10px' }} onClick={handleStartOver}>
          ↺ Start Over
        </button>

        <div className="logo no-print">
          <img src="/logo.svg" alt="Budget4Success" style={{ width: 170, height: 'auto' }} />
        </div>
        <div className="eyebrow no-print">Passion to Profit Coach</div>
        <h1 className="no-print">Budget4Success</h1>
        <p className="subtitle no-print">Turn what you love into a flexible income stream—with a personalized roadmap to guide you.</p>

        <div className="tracker no-print">
          {trackerLabels.map((label, i) => {
            let cls = 'step';
            if (i < trackerActiveIndex) cls += ' done';
            else if (i === trackerActiveIndex) cls += ' active';
            const mark = i < trackerActiveIndex ? '✓' : i + 1;
            return (
              <div className={cls} key={label}>
                <div className="dot">{mark}</div>
                <div className="label">{label}</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          {showTranscript ? (
            <Transcript thread={thread} onBack={() => setShowTranscript(false)} />
          ) : mode === 'stage' || mode === 'final_question' ? (
            <ChatView
              thread={thread}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              busy={busy}
              threadEndRef={threadEndRef}
              placeholder={mode === 'final_question' ? 'Type anything else, or leave blank and press Send to skip...' : 'Type your answer...'}
            />
          ) : mode === 'ready' ? (
            <ReadyScreen
              reportName={reportName}
              setReportName={setReportName}
              error={readyError}
              onGenerate={handleGenerate}
              onReview={() => setShowTranscript(true)}
            />
          ) : mode === 'generating' ? (
            <div className="thread">
              <div className="thinking" style={{ alignSelf: 'center' }}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : mode === 'report_error' ? (
            <div className="error-box">
              Most of your Roadmap generated successfully, but {sectionErrors.length === 1 ? 'one section' : `${sectionErrors.length} sections`} (
              {sectionErrors.map((f) => f.key).join(', ')}) didn&apos;t come through. This is usually temporary.
              <div style={{ marginTop: 10 }}>
                <button className="ghost-btn" onClick={() => generateReport(sectionErrors)}>
                  ↻ Retry missing section{sectionErrors.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          ) : mode === 'report' && reportData ? (
            <ReportView
              r={reportData}
              onViewTranscript={() => setShowTranscript(true)}
              onDownloadPdf={handleDownloadPdf}
              pdfBusy={pdfBusy}
              pdfError={pdfError}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function Transcript({ thread, onBack }) {
  return (
    <>
      <div className="view-transcript no-print">
        <button className="ghost-btn" onClick={onBack}>
          ↩ Back
        </button>
      </div>
      <div className="thread" style={{ maxHeight: 520 }}>
        {thread.map((item, i) =>
          item.type === 'divider' ? (
            <div className="stage-divider" key={i}>
              {item.label}
            </div>
          ) : (
            <div className={`msg ${item.role === 'coach' ? 'coach' : 'user'}`} key={i}>
              {item.text}
            </div>
          )
        )}
      </div>
    </>
  );
}

function ChatView({ thread, inputValue, setInputValue, onSend, onKeyDown, busy, threadEndRef, placeholder }) {
  return (
    <>
      <div className="thread">
        {thread.map((item, i) =>
          item.type === 'divider' ? (
            <div className="stage-divider" key={i}>
              {item.label}
            </div>
          ) : item.type === 'error' ? (
            <div className="error-box" key={i}>
              {item.text}
            </div>
          ) : (
            <div className={`msg ${item.role === 'coach' ? 'coach' : 'user'}`} key={i}>
              {item.text}
            </div>
          )
        )}
        {busy && (
          <div className="thinking">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>
      <div className="input-row">
        <textarea
          rows={1}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <button onClick={onSend} disabled={busy}>
          Send
        </button>
      </div>
    </>
  );
}

function ReadyScreen({ reportName, setReportName, error, onGenerate, onReview }) {
  return (
    <div className="report">
      <div className="view-transcript no-print">
        <button className="ghost-btn" onClick={onReview}>
          ↩ Review your conversation
        </button>
      </div>
      <div className="ready-card">
        <div className="logo">
          <img src="/logo.svg" alt="Budget4Success" style={{ width: 150, height: 'auto' }} />
        </div>
        <h2 className="ready-title">You&apos;re ready for your Roadmap</h2>
        <p className="ready-subtitle">Tell us who this is for, and we&apos;ll put your personalized Passion to Profit Roadmap together.</p>
        <label className="field-label" htmlFor="reportName">
          Your name
        </label>
        <input
          type="text"
          id="reportName"
          placeholder="Jane Smith"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
        />
        {error && (
          <div className="error-box" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <button className="generate-btn" onClick={onGenerate}>
          Generate My Roadmap →
        </button>
      </div>
    </div>
  );
}

function gaugeRow(label, score) {
  return (
    <div className="gauge-row" key={label}>
      <div className="gauge-top">
        <span>{label}</span>
        <span>{score}/20</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${(score / 20) * 100}%` }}></div>
      </div>
    </div>
  );
}

function ReportView({ r, onViewTranscript, onDownloadPdf, pdfBusy, pdfError }) {
  const total = r.passion_clarity + r.strength_confidence + r.service_alignment + r.business_readiness + r.action_readiness;
  const overall = Math.round((total / 100) * 100);

  return (
    <div className="report">
      <div className="view-transcript no-print">
        <button className="ghost-btn" onClick={onDownloadPdf} disabled={pdfBusy}>
          {pdfBusy ? 'Preparing PDF...' : '📄 Download Branded PDF'}
        </button>
        <button className="ghost-btn" onClick={onViewTranscript}>
          ↩ View full conversation
        </button>
      </div>
      {pdfError && <div className="error-box no-print" style={{ marginBottom: 12 }}>{pdfError}</div>}

      <div className="report-cover">
        <div className="logo">
          <img src="/logo.svg" alt="Budget4Success" style={{ width: 150, height: 'auto' }} />
        </div>
        <h2>Your Passion to Profit Roadmap</h2>
        <p className="print-prepared">Prepared for {r.user_name || 'You'}</p>
        <p className="print-date">
          {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="score-hero">
        <div className="score-num">
          {overall}
          <span style={{ fontSize: 20 }}>/100</span>
        </div>
        <div className="score-label">Purpose score</div>
      </div>

      <div>
        {gaugeRow('Passion clarity', r.passion_clarity)}
        {gaugeRow('Strength confidence', r.strength_confidence)}
        {gaugeRow('Service alignment', r.service_alignment)}
        {gaugeRow('Business readiness', r.business_readiness)}
        {gaugeRow('Action readiness', r.action_readiness)}
      </div>

      {r.improvement_tips && r.improvement_tips.length > 0 && (
        <div className="report-section">
          <h3>Ways to grow your score</h3>
          {r.improvement_tips.map((t, i) => (
            <p style={{ marginBottom: 8 }} key={i}>
              <strong>{t.category}:</strong> {t.tip}
            </p>
          ))}
        </div>
      )}

      <div className="report-section">
        <h3>Your reflection</h3>
        <p>{r.reflection}</p>
      </div>
      <div className="report-section">
        <h3>Suggested niche</h3>
        <p>{r.niche_idea}</p>
      </div>
      <div className="report-section">
        <h3>Mission statement</h3>
        <p>{r.mission_statement}</p>
      </div>
      <div className="report-section">
        <h3>Business name ideas</h3>
        <div className="name-pills">
          {r.business_names.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
      <div className="report-section">
        <h3>Business ideas to explore</h3>
        {r.business_ideas.map((b, i) => (
          <div className="idea-card" key={i}>
            <h4>{b.name}</h4>
            <p className="idea-meta">
              <strong>Ideal client:</strong> {b.ideal_client}
            </p>
            <p className="idea-meta">
              <strong>Signature offer:</strong> {b.signature_offer}
            </p>
            <p className="idea-meta">
              <strong>Income potential:</strong> {b.income_potential} &nbsp;·&nbsp; <strong>Difficulty:</strong> {b.difficulty}
            </p>
          </div>
        ))}
      </div>
      <div className="report-section">
        <h3>Marketing strategy</h3>
        <p>{r.marketing_strategy}</p>
      </div>
      <div className="report-section">
        <h3>YouTube video ideas</h3>
        {r.youtube_ideas.map((y, i) => (
          <p style={{ marginBottom: 6 }} key={i}>
            ▶ {y}
          </p>
        ))}
      </div>
      <div className="report-section">
        <h3>Content &amp; social post ideas</h3>
        {r.social_post_ideas.map((s, i) => (
          <p style={{ marginBottom: 6 }} key={i}>
            • {s}
          </p>
        ))}
      </div>
      <div className="report-section">
        <h3>Lead magnet ideas</h3>
        {r.lead_magnet_ideas.map((l, i) => (
          <p style={{ marginBottom: 6 }} key={i}>
            • {l}
          </p>
        ))}
      </div>
      <div className="report-section">
        <h3>30-day launch plan</h3>
        {r.launch_plan.map((w, i) => (
          <div className="week-block" key={i}>
            <p style={{ marginBottom: 4 }}>
              <strong>
                {w.week}: {w.focus}
              </strong>
            </p>
            <ul className="week-actions">
              {w.actions.map((a, j) => (
                <li key={j}>{a}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="report-section">
        <h3>Your first step (progress, not perfection)</h3>
        <p>{r.first_step}</p>
      </div>
      <div className="report-section cta-section">
        <h3>Ready to bring this to life?</h3>
        <p>
          Reading a roadmap and living it are two different things. If you&apos;d love hands-on help turning one of
          these business ideas into something real — or want a guide walking beside you through your 30-Day Launch
          Plan instead of doing it alone — book a free 30-minute discovery call with Onyx Jones. Come with questions,
          come with doubts, come exactly as you are.
        </p>
        <div className="cta">
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="cta-link">
            Book Your Free Discovery Call →
          </a>
        </div>
      </div>
    </div>
  );
}
