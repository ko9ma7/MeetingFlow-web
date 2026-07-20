import { useEffect, useMemo, useRef, useState } from "react";
import { createLocalReport } from "./report";
import { loadMeetings, saveMeetings } from "./storage";
import type { Meeting, View } from "./types";

const meetingTypes = ["일반 업무 회의", "사내·업체 미팅", "설계·기술 검토", "고객·영업 상담", "인터뷰·면접", "강의·교육"];
const languages = [
  ["ko-KR", "한국어"],
  ["en-US", "English"],
  ["ja-JP", "日本語"],
  ["zh-CN", "中文"],
];

const demoTranscript = `[00:00:04] 이번 주 금요일까지 모바일 회의 화면의 시안을 확정하기로 합의했습니다.
[00:00:13] 민수님이 접근성 검토 결과를 목요일 오후까지 공유해야 합니다.
[00:00:22] 브라우저 음성 인식은 지원 범위와 개인정보 안내를 온보딩에 명확히 표시해야 합니다.
[00:00:34] 다음 배포에 오디오 파일 가져오기를 포함할지는 추가 검토가 필요합니다.`;

type IconName = "mic" | "history" | "file" | "info" | "lock" | "download" | "check" | "spark" | "trash" | "menu";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
    check: <path d="m4 12 5 5L20 6"/>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function App() {
  const [view, setView] = useState<View>("record");
  const [meetings, setMeetings] = useState<Meeting[]>(loadMeetings);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("새 미팅");
  const [meetingType, setMeetingType] = useState(meetingTypes[0]);
  const [language, setLanguage] = useState("ko-KR");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState("마이크를 선택하고 미팅 기록을 시작하세요.");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef("");
  const secondsRef = useRef(0);
  const startedAtRef = useRef("");
  const timerRef = useRef<number | null>(null);

  const activeMeeting = useMemo(() => meetings.find((meeting) => meeting.id === activeId) ?? null, [meetings, activeId]);
  const speechSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    saveMeetings(meetings);
  }, [meetings]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const navigate = (next: View) => {
    setView(next);
    setMobileNavOpen(false);
  };

  const updateMeeting = (id: string, changes: Partial<Meeting>) => {
    setMeetings((current) => current.map((meeting) => meeting.id === id ? { ...meeting, ...changes } : meeting));
  };

  const startSpeechRecognition = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("이 브라우저는 실시간 음성 인식을 지원하지 않습니다. 녹음 후 검토 화면에서 전사를 직접 입력할 수 있습니다.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.onresult = (event) => {
      let nextInterim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0].transcript.trim();
        if (result.isFinal && text) {
          const line = `[${formatDuration(secondsRef.current)}] ${text}`;
          transcriptRef.current = `${transcriptRef.current}${transcriptRef.current ? "\n" : ""}${line}`;
          setTranscript(transcriptRef.current);
        } else {
          nextInterim += text;
        }
      }
      setInterim(nextInterim);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech") setNotice(`음성 인식 상태: ${event.error}. 녹음은 계속 저장됩니다.`);
    };
    recognition.onend = () => {
      if (recorderRef.current?.state === "recording") {
        try { recognition.start(); } catch { setNotice("음성 인식을 다시 시작하지 못했습니다. 녹음은 계속 저장됩니다."); }
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const startRecording = async () => {
    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      transcriptRef.current = "";
      secondsRef.current = 0;
      startedAtRef.current = new Date().toISOString();
      setAudioUrl(null);
      setTranscript("");
      setInterim("");
      setSeconds(0);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        const meeting: Meeting = {
          id: crypto.randomUUID(),
          title: title.trim() || "제목 없는 미팅",
          meetingType,
          startedAt: startedAtRef.current,
          durationSeconds: secondsRef.current,
          rawTranscript: transcriptRef.current,
          transcript: transcriptRef.current,
          report: "",
          reviewed: false,
          language,
        };
        setMeetings((current) => [meeting, ...current]);
        setActiveId(meeting.id);
        setView("review");
        setNotice("녹음이 끝났습니다. 전사를 확인하고 필요한 부분을 수정하세요.");
      };
      recorder.start(1000);
      setRecording(true);
      setNotice(speechSupported ? "녹음과 실시간 전사가 진행 중입니다." : "녹음 중입니다. 이 브라우저에서는 실시간 전사를 지원하지 않습니다.");
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
      startSpeechRecognition();
    } catch (error) {
      const message = error instanceof Error ? error.message : "마이크를 열 수 없습니다.";
      setNotice(`마이크 권한을 확인해 주세요. ${message}`);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
    setInterim("");
  };

  const loadDemo = () => {
    const meeting: Meeting = {
      id: crypto.randomUUID(),
      title: "MeetingFlow 웹 전환 회의",
      meetingType: "설계·기술 검토",
      startedAt: new Date().toISOString(),
      durationSeconds: 46,
      rawTranscript: demoTranscript,
      transcript: demoTranscript,
      report: "",
      reviewed: false,
      language: "ko-KR",
    };
    setMeetings((current) => [meeting, ...current]);
    setActiveId(meeting.id);
    setView("review");
    setNotice("체험용 전사를 불러왔습니다. 내용을 수정한 뒤 검토를 완료해 보세요.");
  };

  const completeReview = () => {
    if (!activeMeeting) return;
    updateMeeting(activeMeeting.id, { reviewed: true });
    setNotice("검토본을 저장했습니다. 이제 이 내용만 보고서의 근거로 사용됩니다.");
    setView("report");
  };

  const generateReport = () => {
    if (!activeMeeting?.reviewed) {
      setNotice("보고서를 만들기 전에 전사 검토를 완료해 주세요.");
      setView("review");
      return;
    }
    updateMeeting(activeMeeting.id, { report: createLocalReport(activeMeeting.title, activeMeeting.transcript) });
    setNotice("검토본을 근거로 로컬 보고서 초안을 만들었습니다.");
  };

  const downloadText = (content: string, filename: string, type = "text/markdown;charset=utf-8") => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportMeeting = (meeting: Meeting) => {
    const content = `${meeting.report || `# ${meeting.title}`}\n\n## 검토한 전사본\n\n${meeting.transcript}\n\n## 변경되지 않는 원본\n\n${meeting.rawTranscript}`;
    downloadText(content, `${meeting.title.replace(/[\\/:*?"<>|]/g, "-")}.md`);
  };

  const selectMeeting = (meeting: Meeting, destination: View = "review") => {
    setActiveId(meeting.id);
    setView(destination);
    setMobileNavOpen(false);
  };

  const removeMeeting = (meeting: Meeting) => {
    if (!window.confirm(`“${meeting.title}” 기록을 이 브라우저에서 삭제할까요?`)) return;
    setMeetings((current) => current.filter((item) => item.id !== meeting.id));
    if (activeId === meeting.id) {
      setActiveId(null);
      setView("history");
    }
  };

  const navItems: { id: View; label: string; icon: IconName }[] = [
    { id: "record", label: "새 회의", icon: "mic" },
    { id: "history", label: "회의 기록", icon: "history" },
    { id: "about", label: "서비스 안내", icon: "info" },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <button className="brand" onClick={() => navigate("record")} aria-label="MeetingFlow 홈">
          <span className="brand-mark">M<span>F</span></span>
          <span><strong>MeetingFlow</strong><small>MEETINGS, IN FLOW</small></span>
        </button>
        <nav aria-label="주요 메뉴">
          <p className="nav-label">WORKSPACE</p>
          {navItems.map((item) => (
            <button key={item.id} className={(view === item.id || (item.id === "record" && ["review", "report"].includes(view))) ? "active" : ""} onClick={() => navigate(item.id)}>
              <Icon name={item.icon}/><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="local-card">
          <span className="status-dot"/><div><small>저장 위치</small><strong>이 브라우저에만</strong></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-expanded={mobileNavOpen} aria-label="메뉴 열기"><Icon name="menu"/></button>
          <div><small>MEETING WORKSPACE</small><h1>{view === "history" ? "회의 기록" : view === "about" ? "서비스 안내" : "새 회의"}</h1></div>
          <div className="privacy"><Icon name="lock" size={17}/><span>계정 없음 · 로컬 저장</span></div>
        </header>

        <div className="workspace">
          {view !== "history" && view !== "about" && (
            <ol className="flow-steps" aria-label="회의 처리 단계">
              {[["record", "기록", "브라우저 녹음"], ["review", "검토", "원문 확인"], ["report", "보고서", "검토본으로 생성"]].map(([id, label, detail], index) => {
                const order = ["record", "review", "report"];
                const current = order.indexOf(view);
                const state = index < current ? "done" : index === current ? "current" : "";
                return <li key={id} className={state}><button onClick={() => index <= current && navigate(id as View)} disabled={index > current}><span>{state === "done" ? <Icon name="check" size={15}/> : index + 1}</span><div><strong>{label}</strong><small>{detail}</small></div></button></li>;
              })}
            </ol>
          )}

          <div className={`notice ${notice.includes("권한") ? "error" : ""}`} role="status">{notice}</div>

          {view === "record" && (
            <section className="record-layout">
              <div className="setup-panel panel">
                <p className="eyebrow">SET THE CONTEXT</p>
                <h2>무엇을 기록할까요?</h2>
                <p className="section-copy">회의의 맥락을 먼저 남기면 나중에 기록을 찾고 정리하기 쉬워집니다.</p>
                <label>회의 제목<input value={title} onChange={(event) => setTitle(event.target.value)} disabled={recording}/></label>
                <label>회의 유형<select value={meetingType} onChange={(event) => setMeetingType(event.target.value)} disabled={recording}>{meetingTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>인식 언어<select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={recording}>{languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <div className="browser-note"><span className={speechSupported ? "status-dot" : "status-dot warning"}/><p><strong>{speechSupported ? "실시간 인식 사용 가능" : "실시간 인식 미지원"}</strong><small>음성 인식은 브라우저 제공자에 따라 네트워크에서 처리될 수 있습니다.</small></p></div>
              </div>

              <div className={`recorder-panel panel ${recording ? "is-recording" : ""}`}>
                <div className="recorder-top"><span className="live-state"><i/>{recording ? "RECORDING" : "READY"}</span><span>MIC · {languages.find(([value]) => value === language)?.[1]}</span></div>
                <div className="timer" aria-label={`녹음 시간 ${formatDuration(seconds)}`}>{formatDuration(seconds)}</div>
                <div className="waveform" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--level": `${22 + ((index * 37) % 72)}%`, "--delay": `${(index % 7) * -0.11}s` } as React.CSSProperties}/>)}</div>
                <div className="live-transcript" aria-live="polite">
                  <p className="eyebrow">LIVE TRANSCRIPT</p>
                  <div>{transcript || interim ? <>{transcript && <span>{transcript.split("\n").at(-1)}</span>} {interim && <em>{interim}</em>}</> : <span className="placeholder">말하는 내용이 여기에 표시됩니다.</span>}</div>
                </div>
                <div className="recorder-actions">
                  {!recording ? <button className="primary large" onClick={startRecording}><Icon name="mic"/>미팅 기록 시작</button> : <button className="stop large" onClick={stopRecording}><span className="stop-square"/>종료하고 검토하기</button>}
                  {!recording && <button className="ghost" onClick={loadDemo}>샘플로 먼저 체험</button>}
                </div>
              </div>
            </section>
          )}

          {view === "review" && activeMeeting && (
            <section className="review-layout">
              <div className="document-panel panel">
                <div className="panel-heading"><div><p className="eyebrow">REVIEW THE SOURCE</p><h2>전사 원문 검토</h2></div><span className="count">{activeMeeting.transcript.length.toLocaleString()}자</span></div>
                <label className="sr-only" htmlFor="transcript">검토할 전사 내용</label>
                <textarea id="transcript" className="transcript-editor" value={activeMeeting.transcript} onChange={(event) => updateMeeting(activeMeeting.id, { transcript: event.target.value, reviewed: false, report: "" })} placeholder="전사 내용을 입력하거나 수정하세요."/>
                <div className="source-proof"><Icon name="lock" size={16}/><span>원본은 별도로 보존됩니다. 수정한 검토본만 보고서에 사용합니다.</span></div>
              </div>
              <aside className="review-aside panel">
                <p className="eyebrow">MEETING CONTEXT</p><h3>{activeMeeting.title}</h3>
                <dl><div><dt>기록 시각</dt><dd>{formatDate(activeMeeting.startedAt)}</dd></div><div><dt>길이</dt><dd>{formatDuration(activeMeeting.durationSeconds)}</dd></div><div><dt>유형</dt><dd>{activeMeeting.meetingType}</dd></div><div><dt>상태</dt><dd>{activeMeeting.reviewed ? "검토 완료" : "검토 대기"}</dd></div></dl>
                <button className="primary full" onClick={completeReview} disabled={!activeMeeting.transcript.trim()}><Icon name="check"/>검토 완료하고 계속</button>
                {audioUrl && <a className="secondary full" href={audioUrl} download={`${activeMeeting.title}.webm`}><Icon name="download"/>이번 녹음 내려받기</a>}
              </aside>
            </section>
          )}

          {view === "review" && !activeMeeting && <EmptyState onAction={() => navigate("record")}/>} 

          {view === "report" && activeMeeting && (
            <section className="report-layout">
              <div className="report-paper panel">
                <div className="panel-heading"><div><p className="eyebrow">EVIDENCE-BASED NOTES</p><h2>{activeMeeting.report ? "회의록 초안" : "보고서 준비"}</h2></div>{activeMeeting.report && <button className="secondary" onClick={() => exportMeeting(activeMeeting)}><Icon name="download"/>Markdown</button>}</div>
                {activeMeeting.report ? <pre>{activeMeeting.report}</pre> : <div className="report-empty"><span><Icon name="spark" size={32}/></span><h3>검토한 원문으로 초안을 만듭니다</h3><p>원문에 있는 표현만 분류해 주요 논의, 결정사항, 실행 항목을 정리합니다. 생성 후 반드시 사실관계를 확인하세요.</p><button className="primary" onClick={generateReport}><Icon name="spark"/>로컬 보고서 만들기</button></div>}
              </div>
              <aside className="report-aside panel"><p className="eyebrow">TRUST CHECK</p><h3>보고서 원칙</h3><ul><li><Icon name="check"/>검토 완료본만 사용</li><li><Icon name="check"/>외부 API 호출 없음</li><li><Icon name="check"/>결과를 원문과 분리 저장</li></ul><button className="ghost full" onClick={() => navigate("review")}>전사 다시 검토</button></aside>
            </section>
          )}

          {view === "report" && !activeMeeting && <EmptyState onAction={() => navigate("history")}/>} 

          {view === "history" && (
            <section className="history-section">
              <div className="history-intro"><div><p className="eyebrow">YOUR LOCAL ARCHIVE</p><h2>기억은 브라우저에,<br/>결정은 손안에.</h2></div><p>이 기기와 브라우저에 저장된 회의만 표시합니다. 계정이나 서버로 동기화하지 않습니다.</p></div>
              {meetings.length ? <div className="meeting-list">{meetings.map((meeting, index) => <article key={meeting.id} className="meeting-card"><span className="meeting-index">{String(index + 1).padStart(2, "0")}</span><div className="meeting-main"><small>{formatDate(meeting.startedAt)} · {formatDuration(meeting.durationSeconds)}</small><h3>{meeting.title}</h3><p>{meeting.transcript.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/g, "").slice(0, 110) || "아직 작성된 전사가 없습니다."}</p><div className="tags"><span>{meeting.meetingType}</span><span className={meeting.reviewed ? "reviewed" : ""}>{meeting.reviewed ? "검토 완료" : "검토 대기"}</span>{meeting.report && <span>보고서 있음</span>}</div></div><div className="card-actions"><button className="secondary" onClick={() => selectMeeting(meeting, meeting.report ? "report" : "review")}>열기</button><button className="icon-button" onClick={() => exportMeeting(meeting)} aria-label={`${meeting.title} 내보내기`}><Icon name="download"/></button><button className="icon-button danger" onClick={() => removeMeeting(meeting)} aria-label={`${meeting.title} 삭제`}><Icon name="trash"/></button></div></article>)}</div> : <EmptyState onAction={() => navigate("record")}/>} 
            </section>
          )}

          {view === "about" && (
            <section className="about-section panel">
              <div><p className="eyebrow">MEETINGFLOW WEB · 1.0</p><h2>회의에 봇을 초대하지 않아도,<br/>흐름은 남습니다.</h2><p className="about-lead">MeetingFlow의 로컬 우선 철학을 브라우저로 옮긴 공개 웹 버전입니다. 설치 없이 녹음하고, 직접 확인한 전사로 회의록 초안을 만들 수 있습니다.</p><a className="primary inline" href="https://github.com/ko9ma7/MeetingFlow" target="_blank" rel="noreferrer">원본 Windows 앱 보기</a></div>
              <div className="principles"><article><span>01</span><h3>기록</h3><p>마이크 녹음은 브라우저 안에서 처리하고 직접 내려받습니다.</p></article><article><span>02</span><h3>검토</h3><p>자동 인식 결과를 사용자가 확인하기 전에는 보고서로 넘기지 않습니다.</p></article><article><span>03</span><h3>정리</h3><p>외부 AI 없이도 원문 근거를 분류한 회의록 초안을 만듭니다.</p></article></div>
              <div className="limitation"><strong>웹 버전의 차이</strong><p>Windows 앱의 시스템 오디오 루프백과 로컬 Whisper 정밀 전사는 브라우저 보안 모델상 제공하지 않습니다. Chrome 계열 브라우저의 음성 인식은 제공자 서버를 사용할 수 있으므로 민감한 회의에서는 녹음만 사용하고 전사를 직접 입력하세요.</p></div>
            </section>
          )}
        </div>
      </main>
      {mobileNavOpen && <button className="backdrop" onClick={() => setMobileNavOpen(false)} aria-label="메뉴 닫기"/>}
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return <div className="empty-state panel"><span><Icon name="file" size={30}/></span><h2>아직 회의 기록이 없습니다</h2><p>새 회의를 녹음하거나 샘플 흐름을 체험해 보세요.</p><button className="primary" onClick={onAction}>새 회의 시작</button></div>;
}

export default App;
