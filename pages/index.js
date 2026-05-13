import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

const VOICES = [
  { id: 'fLvpMIGwcTmxzsUF4z1U', name: 'Harry — 부드럽고 안정감 있는 남성' },
];

const LOAD_MSGS = [
  '교육 목표를 분석하고 있어요',
  '학습 구조를 설계하는 중이에요',
  '장면별 시나리오를 작성하고 있어요',
  '영상 프롬프트를 최적화하는 중이에요',
  '내레이션 스크립트를 다듬고 있어요',
];

const STORAGE_KEY = 'edustudio_session';

function saveSession(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export default function Home() {
  const [topic, setTopic] = useState('힉스필드 Soul · 나노바나나로 Brand Image 만들기');
  const [audience, setAudience] = useState('전사 디자이너');
  const [level, setLevel] = useState('기초');
  const [objectives, setObjectives] = useState(
    '1. 힉스필드 Soul로 브랜드에 맞는 AI 모델을 생성할 수 있다\n2. 나노바나나로 제품 및 서비스를 자연스럽게 합성할 수 있다\n3. 두 툴을 연계하여 실무 Brand Image를 완성할 수 있다'
  );
  const [duration, setDuration] = useState('10분');
  const [sceneCount, setSceneCount] = useState('10');
  const [tone, setTone] = useState('친근하고 쉬운');
  const [extra, setExtra] = useState('사례 중심, 실제 디자이너 공감 사례, 실습 중심 구성');
  const [voiceId, setVoiceId] = useState(VOICES[0].id);

  const [view, setView] = useState('empty');
  const [loadMsg, setLoadMsg] = useState(LOAD_MSGS[0]);
  const [loadTitle, setLoadTitle] = useState('시나리오 작성 중');
  const [scenario, setScenario] = useState(null);
  const [err1, setErr1] = useState('');
  const [err2, setErr2] = useState('');
  const [step, setStep] = useState(1);
  const [voiceStatus, setVoiceStatus] = useState('wait');
  const [audioMap, setAudioMap] = useState({});
  const [voiceErrors, setVoiceErrors] = useState({});
  const [generatingScene, setGeneratingScene] = useState(null);
  const [openScenes, setOpenScenes] = useState({});
  const [btn1Loading, setBtn1Loading] = useState(false);
  const [btn2Loading, setBtn2Loading] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [mediaMap, setMediaMap] = useState({}); // scene_no → { type, url, name }
  const [klingMap, setKlingMap] = useState({});
  const [klingGenerating, setKlingGenerating] = useState({});
  const [klingProgress, setKlingProgress] = useState({});
  const [lastTaskIds, setLastTaskIds] = useState({});
  const fileInputRefs = useRef({});
  const msgTimer = useRef(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      if (session.topic) setTopic(session.topic);
      if (session.audience) setAudience(session.audience);
      if (session.level) setLevel(session.level);
      if (session.objectives) setObjectives(session.objectives);
      if (session.duration) setDuration(session.duration);
      if (session.sceneCount) setSceneCount(session.sceneCount);
      if (session.tone) setTone(session.tone);
      if (session.extra) setExtra(session.extra);
      if (session.scenario) {
        setScenario(session.scenario);
        setView('result');
        setStep(session.step || 2);
        setVoiceStatus(session.voiceStatus || 'wait');
        setSavedAt(session.savedAt || null);
        if (session.audioBase64) {
          const restored = {};
          Object.entries(session.audioBase64).forEach(([no, b64]) => {
            try {
              const byteStr = atob(b64);
              const buf = new Uint8Array(byteStr.length);
              for (let i = 0; i < byteStr.length; i++) buf[i] = byteStr.charCodeAt(i);
              const blob = new Blob([buf], { type: 'audio/mpeg' });
              restored[no] = URL.createObjectURL(blob);
            } catch(_) {}
          });
          setAudioMap(restored);
        }
      }
    }
  }, []);

  async function persistSession(updates) {
    const session = loadSession() || {};
    const newSession = {
      ...session,
      topic, audience, level, objectives, duration, sceneCount, tone, extra,
      ...updates,
      savedAt: new Date().toLocaleString('ko-KR'),
    };
    saveSession(newSession);
    setSavedAt(newSession.savedAt);
  }

  async function blobToBase64(blob) {
    return new Promise((res) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  async function retrieveVideo(sceneNo) {
    const taskId = lastTaskIds[sceneNo];
    if (!taskId) { alert('저장된 Task ID가 없어요.'); return; }
    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, scene_no: sceneNo, action: 'retrieve' })
      });
      const data = await res.json();
      console.log('[retrieve]', JSON.stringify(data));
      if (data.video_url) {
        setKlingMap(prev => ({ ...prev, [sceneNo]: data.video_url }));
        alert(`장면 ${sceneNo} 영상 복구 완료!`);
      } else {
        alert(`영상 URL을 찾지 못했어요.\nraw_output: ${JSON.stringify(data.raw_output)}`);
      }
    } catch(e) { alert('복구 실패: ' + e.message); }
  }

  async function generateScenario() {
    if (!topic || !audience || !objectives) {
      setErr1('교육 주제, 학습 대상, 학습 목표를 모두 입력해주세요.');
      return;
    }
    setErr1('');
    setBtn1Loading(true);
    setLoadTitle('시나리오 작성 중');
    setView('loading');
    let i = 0;
    setLoadMsg(LOAD_MSGS[0]);
    msgTimer.current = setInterval(() => {
      i = (i + 1) % LOAD_MSGS.length;
      setLoadMsg(LOAD_MSGS[i]);
    }, 2200);

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience, level, objectives, duration, scenes: sceneCount, tone, extra })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScenario(data);
      setAudioMap({});
      setVoiceErrors({});
      setVoiceStatus('wait');
      setStep(2);
      setView('result');
      await persistSession({
        scenario: data, step: 2, voiceStatus: 'wait', audioBase64: {},
        topic, audience, level, objectives, duration, sceneCount, tone, extra
      });
    } catch (e) {
      setErr1(e.message);
      setView('empty');
    }
    clearInterval(msgTimer.current);
    setBtn1Loading(false);
  }

  async function generateVoice() {
    if (!scenario) { setErr2('먼저 시나리오를 생성해주세요.'); return; }
    setErr2('');
    setBtn2Loading(true);
    setVoiceStatus('running');
    const newAudioMap = { ...audioMap };
    const newBase64Map = {};
    const newErrors = {};

    for (const sc of scenario.scenes) {
      setGeneratingScene(sc.scene_no);
      try {
        const res = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ narration: sc.narration, voiceId })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        newAudioMap[sc.scene_no] = url;
        setAudioMap({ ...newAudioMap });
        const b64 = await blobToBase64(blob);
        newBase64Map[sc.scene_no] = b64;
      } catch (e) {
        newErrors[sc.scene_no] = e.message;
        setVoiceErrors({ ...newErrors });
      }
    }
    setGeneratingScene(null);
    setVoiceStatus('done');
    setStep(3);
    setBtn2Loading(false);
    await persistSession({
      scenario, step: 3, voiceStatus: 'done', audioBase64: newBase64Map,
      topic, audience, level, objectives, duration, sceneCount, tone, extra
    });
  }

  function handleMediaUpload(sceneNo, file) {
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const url = URL.createObjectURL(file);
    setMediaMap(prev => ({ ...prev, [sceneNo]: { type, url, name: file.name } }));
  }

  function removeMedia(sceneNo) {
    setMediaMap(prev => { const n={...prev}; delete n[sceneNo]; return n; });
  }

  async function generateKlingScene(sc) {
    setKlingGenerating(prev => ({ ...prev, [sc.scene_no]: true }));
    setKlingProgress(prev => ({ ...prev, [sc.scene_no]: '요청 전송 중...' }));
    try {
      const createRes = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_prompt: sc.screen_prompt, scene_no: sc.scene_no, action: 'create' })
      });
      const text = await createRes.text();
      let createData;
      try { createData = JSON.parse(text); }
      catch(_) { throw new Error('서버 응답 오류: ' + text.slice(0, 200)); }
      if (!createRes.ok) throw new Error(createData.error);
      const { task_id } = createData;

      // task_id 저장 (폴링 실패 시 수동 복구용)
      setLastTaskIds(prev => ({ ...prev, [sc.scene_no]: task_id }));

      let videoUrl = null;
      for (let i = 0; i < 60; i++) {
        const elapsed = ((i + 1) * 5);
        setKlingProgress(prev => ({ ...prev, [sc.scene_no]: `생성 중... ${elapsed}초 경과 (최대 5분)` }));
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id, scene_no: sc.scene_no, action: 'status' })
        });
        const statusText = await statusRes.text();
        let statusData;
        try { statusData = JSON.parse(statusText); }
        catch(_) { continue; }
        console.log(`[Scene ${sc.scene_no}] ${i+1}/60 status:`, statusData.raw_status, '| output:', JSON.stringify(statusData.raw_output));
        if (statusData.status === 'succeed' && statusData.video_url) {
          videoUrl = statusData.video_url; break;
        }
        // 완료됐는데 URL 못 찾은 경우
        if (statusData.raw_status === 'completed' && !statusData.video_url) {
          console.warn('[Seedance] completed but no video_url! raw_output:', statusData.raw_output);
          throw new Error(`영상 완료됐지만 URL을 찾지 못했어요.\nraw_output: ${JSON.stringify(statusData.raw_output)}\n\n'영상 복구' 버튼을 눌러주세요.`);
        }
        if (statusData.raw_status === 'failed') throw new Error(`생성 실패`);
      }
      if (!videoUrl) throw new Error('시간 초과. \'영상 복구\' 버튼으로 결과를 가져올 수 있어요.');
      setKlingMap(prev => ({ ...prev, [sc.scene_no]: videoUrl }));
    } catch(e) {
      alert(`장면 ${sc.scene_no} 오류: ${e.message}`);
    }
    setKlingGenerating(prev => ({ ...prev, [sc.scene_no]: false }));
    setKlingProgress(prev => ({ ...prev, [sc.scene_no]: '' }));
  }

  function toggleScene(no) {
    setOpenScenes(prev => ({ ...prev, [no]: !prev[no] }));
  }

  function copyText(text, msg) {
    navigator.clipboard.writeText(text);
    alert(msg);
  }

  function downloadAll() {
    Object.entries(audioMap).forEach(([no, url]) => {
      const a = document.createElement('a');
      a.href = url; a.download = `scene_${no}.mp3`; a.click();
    });
  }

  function reset() {
    if (!confirm('모든 작업 내용이 삭제됩니다. 초기화할까요?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setScenario(null); setAudioMap({}); setVoiceErrors({});
    setVoiceStatus('wait'); setStep(1); setView('empty');
    setErr1(''); setErr2(''); setOpenScenes({}); setSavedAt(null);
  }

  const tot = scenario ? scenario.scenes.reduce((a, c) => a + (c.duration_sec || 0), 0) : 0;
  const chars = scenario ? scenario.scenes.reduce((a, c) => a + (c.narration || '').length, 0) : 0;

  return (
    <>
      <Head><title>EduStudio</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div className="root">
        <header>
          <span className="logo">EduStudio</span>
          <div className="steps">
            {[{n:1,name:'시나리오'},{n:2,name:'음성'},{n:3,name:'영상'},{n:4,name:'자막'},{n:5,name:'합성'}].map((s,i)=>(
              <div key={s.n} style={{display:'flex',alignItems:'center',gap:0}}>
                {i>0 && <div className="sdiv"/>}
                <div className={`step${step===s.n?' active':step>s.n?' done':''}`}>
                  <span className="step-n">{s.n}</span>
                  <span className="step-name">{s.name}</span>
                </div>
              </div>
            ))}
          </div>
          {savedAt && (
            <div className="save-badge">
              <span className="save-dot"/>
              {savedAt} 저장됨
            </div>
          )}
        </header>

        <div className="app">
          <div className="lp">
            <div className="lp-head">
              <div className="lp-title">콘텐츠 설정</div>
              <div className="lp-sub">교육 정보를 입력하고 AI로 생성하세요</div>
            </div>
            <div className="lp-body">
              <div className="fg">
                <label>교육 주제</label>
                <input type="text" value={topic} onChange={e=>setTopic(e.target.value)}/>
              </div>
              <div className="r2">
                <div className="fg">
                  <label>학습 대상</label>
                  <input type="text" value={audience} onChange={e=>setAudience(e.target.value)}/>
                </div>
                <div className="fg">
                  <label>수준</label>
                  <select value={level} onChange={e=>setLevel(e.target.value)}>
                    <option>입문</option><option>기초</option><option>중급</option>
                  </select>
                </div>
              </div>
              <div className="fg">
                <label>학습 목표</label>
                <textarea value={objectives} onChange={e=>setObjectives(e.target.value)} rows={4}/>
                <div className="hint">핵심 목표 2~4개를 번호로 작성하세요</div>
              </div>
              <div className="div"/>
              <div className="r2">
                <div className="fg">
                  <label>영상 길이</label>
                  <select value={duration} onChange={e=>setDuration(e.target.value)}>
                    <option>3분</option><option>5분</option><option>7분</option><option>10분</option>
                  </select>
                </div>
                <div className="fg">
                  <label>장면 수</label>
                  <select value={sceneCount} onChange={e=>setSceneCount(e.target.value)}>
                    <option>4</option><option>6</option><option>8</option><option>10</option>
                  </select>
                </div>
              </div>
              <div className="fg">
                <label>영상 톤</label>
                <select value={tone} onChange={e=>setTone(e.target.value)}>
                  <option value="전문적이고 신뢰감 있는">전문적 · 신뢰감</option>
                  <option value="친근하고 쉬운">친근 · 쉬운</option>
                  <option value="활기차고 동기부여하는">활기 · 동기부여</option>
                  <option value="차분하고 교육적인">차분 · 교육적</option>
                </select>
              </div>
              <div className="fg">
                <label>추가 요청 <span className="opt-label">(선택)</span></label>
                <input type="text" value={extra} onChange={e=>setExtra(e.target.value)}/>
              </div>
              {err1 && <div className="err">{err1}</div>}
              {step >= 2 && (
                <div className="s2-section">
                  <div className="div" style={{marginTop:16}}/>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                    <span className="s2-tag">Step 2</span>
                    <span className="s2-label">음성 생성</span>
                  </div>
                  <div className="fg">
                    <label>AI 성우</label>
                    <select value={voiceId} onChange={e=>setVoiceId(e.target.value)}>
                      {VOICES.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  {err2 && <div className="err">{err2}</div>}
                </div>
              )}
            </div>
            <div className="lp-foot">
              <button className="btn-blue" onClick={generateScenario} disabled={btn1Loading}>
                {btn1Loading ? '생성 중...' : scenario ? '시나리오 재생성하기' : '시나리오 생성하기'}
              </button>
              {step >= 2 && (
                <button className="btn-dark" onClick={generateVoice} disabled={btn2Loading}>
                  {btn2Loading ? `음성 생성 중... (${generatingScene||''}장면)` : voiceStatus==='done' ? `음성 완성 — ${Object.keys(audioMap).length}/${scenario?.scenes.length}장면` : '음성 생성하기'}
                </button>
              )}
            </div>
          </div>

          <div className="rp">
            {view === 'empty' && (
              <div className="empty">
                <div className="empty-icon">✦</div>
                <div className="empty-t">시나리오가 여기에 생성됩니다</div>
                <div className="empty-s">왼쪽에서 교육 정보를 입력하고<br/>생성 버튼을 누르면 장면별 시나리오가 자동으로 만들어져요</div>
                <div className="guide-grid">
                  <div className="gc"><div className="gc-step">Step 1</div><div className="gc-t">시나리오 생성</div><div className="gc-s">Claude가 장면별 대본과 영상 지문을 자동 작성</div></div>
                  <div className="gc"><div className="gc-step">Step 2</div><div className="gc-t">음성 생성</div><div className="gc-s">ElevenLabs로 AI 성우 내레이션 자동 생성</div></div>
                  <div className="gc"><div className="gc-step">Step 3–5</div><div className="gc-t">영상 · 합성</div><div className="gc-s">미디어 업로드 후 자막·음성 자동 합성</div></div>
                </div>
              </div>
            )}
            {view === 'loading' && (
              <div className="loading">
                <div className="ring"/>
                <div className="load-t">{loadTitle}</div>
                <div className="load-s">{loadMsg}</div>
              </div>
            )}
            {view === 'result' && scenario && (
              <div className="result">
                <div className="r-top">
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                    <div>
                      <div className="r-eyebrow">시나리오 생성 완료</div>
                      <div className="r-title">{scenario.title}</div>
                      <div className="r-summary">{scenario.summary}</div>
                    </div>
                    {savedAt && (
                      <div className="r-saved">
                        <span className="save-dot-w"/>
                        {savedAt} 자동 저장
                      </div>
                    )}
                  </div>
                  <div className="r-stats">
                    <div className="rs"><div className="rs-v">{scenario.scenes.length}</div><div className="rs-l">총 장면</div></div>
                    <div className="rs"><div className="rs-v">{Math.floor(tot/60)}분 {tot%60}초</div><div className="rs-l">예상 시간</div></div>
                    <div className="rs"><div className="rs-v">{chars.toLocaleString()}자</div><div className="rs-l">내레이션</div></div>
                    {Object.keys(audioMap).length > 0 && (
                      <div className="rs"><div className="rs-v" style={{color:'#2997ff'}}>{Object.keys(audioMap).length}</div><div className="rs-l">음성 완성</div></div>
                    )}
                  </div>
                </div>
                <div className="r-actions">
                  <button className="act" onClick={()=>copyText(JSON.stringify(scenario,null,2),'JSON 복사 완료')}>JSON 복사 ›</button>
                  <button className="act" onClick={()=>copyText(scenario.scenes.map(sc=>`[장면 ${sc.scene_no}] ${sc.chapter}\n${sc.narration}`).join('\n\n'),'내레이션 복사 완료')}>내레이션 복사 ›</button>
                  <button className="act" onClick={()=>copyText(scenario.scenes.map(sc=>`[Scene ${sc.scene_no}] ${sc.chapter}\n${sc.screen_prompt}`).join('\n\n'),'영상 프롬프트 복사 완료')}>영상 프롬프트 복사 ›</button>
                  {Object.keys(audioMap).length > 0 && <button className="act dl" onClick={downloadAll}>MP3 전체 다운로드 ↓</button>}
                  <button className="act ghost" onClick={reset}>초기화</button>
                </div>
                <div className="p-row">
                  <span className="p-label">진행</span>
                  <span className="pp done"><span className="pdot"/>시나리오 완성</span>
                  <span className={`pp${voiceStatus==='done'?' done':voiceStatus==='running'?' running':''}`}>
                    <span className="pdot"/>
                    {voiceStatus==='done'?`음성 완성 (${Object.keys(audioMap).length}/${scenario.scenes.length})`:voiceStatus==='running'?'음성 생성 중...':'음성 대기'}
                  </span>
                  <span className="pp"><span className="pdot"/>영상 업로드 대기</span>
                  <span className="pp"><span className="pdot"/>자막 대기</span>
                  <span className="pp"><span className="pdot"/>합성 대기</span>
                </div>
                <div className="scenes-wrap">
                  <div className="scenes-lbl">장면별 시나리오</div>
                  <div className="sc-grid">
                  {scenario.scenes.map(sc => {
                    const m=Math.floor((sc.duration_sec||0)/60), s=(sc.duration_sec||0)%60;
                    const isOpen=openScenes[sc.scene_no]===true;
                    const audioUrl=audioMap[sc.scene_no];
                    const voiceErr=voiceErrors[sc.scene_no];
                    const isGen=generatingScene===sc.scene_no;
                    const media=mediaMap[sc.scene_no];
                    const klingUrl=klingMap[sc.scene_no];
                    const isKling=klingGenerating[sc.scene_no];
                    return (
                      <div className="vc" key={sc.scene_no}>
                        {/* 16:9 프리뷰 */}
                        <div className="vc-preview" onClick={()=>!media&&!klingUrl&&fileInputRefs.current[sc.scene_no]?.click()}>

                          {/* 미디어 미리보기 */}
                          {klingUrl ? (
                            <video src={klingUrl} autoPlay muted loop className="vc-media-fill"/>
                          ) : media?.type==='video' ? (
                            <video src={media.url} autoPlay muted loop className="vc-media-fill"/>
                          ) : media?.type==='image' ? (
                            <img src={media.url} alt="preview" className="vc-media-fill"/>
                          ) : (
                            <div className="vc-empty-hint">
                              {isKling ? <span className="spin-s-w"/> : '＋'}
                              <span>{isKling ? (klingProgress[sc.scene_no] || 'Seedance 생성 중...') : '클릭하여 미디어 업로드'}</span>
                            </div>
                          )}

                          {/* 오버레이 배지 */}
                          <div className="vc-overlay-tl">
                            <span className="vc-num">Scene {sc.scene_no}</span>
                            <span className="vc-dur">{m>0?`${m}분 `:''}{s}초</span>
                          </div>
                          {audioUrl && <span className="vc-audio-badge">♪ 음성</span>}
                          {klingUrl && <span className="vc-kling-badge">🎬 Seedance</span>}
                          {media && !klingUrl && <span className="vc-media-badge">{media.type==='video'?'🎥':'🖼'} {media.name}</span>}

                          {/* 생성 중 */}
                          {isGen && <div className="vc-gen"><span className="spin-s-w"/>음성 생성 중...</div>}

                          {/* 미디어 없을 때 프롬프트 텍스트 */}
                          {!media && !klingUrl && !isKling && (
                            <div className="vc-prompt-text">{sc.screen_prompt}</div>
                          )}
                        </div>

                        {/* 카드 액션 버튼 */}
                        <div className="vc-actions">
                          <button className="vc-act-btn upload" onClick={()=>fileInputRefs.current[sc.scene_no]?.click()}>
                            📁 {media ? '교체' : '업로드'}
                          </button>
                          <button className="vc-act-btn kling" onClick={()=>generateKlingScene(sc)} disabled={isKling}>
                            {isKling ? '생성 중...' : '🎬 Seedance 생성'}
                          </button>
                          {lastTaskIds[sc.scene_no] && !klingUrl && (
                            <button className="vc-act-btn" onClick={()=>retrieveVideo(sc.scene_no)}
                              style={{flex:'0 0 auto',background:'#fff',border:'1px solid rgba(0,0,0,0.12)',color:'#1d1d1f',fontSize:11}}>
                              🔄 복구
                            </button>
                          )}
                          {(media||klingUrl) && (
                            <button className="vc-act-btn remove" onClick={()=>{removeMedia(sc.scene_no);setKlingMap(p=>{const n={...p};delete n[sc.scene_no];return n;})}}>✕</button>
                          )}
                          <input
                            ref={el=>fileInputRefs.current[sc.scene_no]=el}
                            type="file" accept="image/*,video/*" style={{display:'none'}}
                            onChange={e=>handleMediaUpload(sc.scene_no,e.target.files[0])}
                          />
                        </div>

                        {/* 카드 정보 */}
                        <div className="vc-info">
                          <div className="vc-chapter">{sc.chapter}</div>
                          <div className="vc-narr">{sc.narration}</div>
                          {audioUrl && (
                            <div className="vc-audio">
                              <audio controls src={audioUrl} style={{width:'100%',height:28}}/>
                              <a className="a-dl" href={audioUrl} download={`scene_${sc.scene_no}.mp3`} style={{marginTop:4,display:'block',textAlign:'right'}}>MP3 ↓</a>
                            </div>
                          )}
                          {klingUrl && (
                            <a className="a-dl" href={klingUrl} download={`scene_${sc.scene_no}.mp4`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:4,textAlign:'right'}}>MP4 ↓</a>
                          )}
                          {voiceErr && <div style={{fontSize:11,color:'#c0392b',marginTop:4}}>오류: {voiceErr}</div>}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
                <div className="np">
                  <div className="np-t">자동화 파이프라인</div>
                  <div className="np-grid">
                    <div className="npc live">
                      <div className="npc-n live">Step 2 · 연동 완료</div>
                      <div className="npc-name">음성 생성</div>
                      <div className="npc-tool">ElevenLabs API</div>
                      <span className="npc-badge live">Active</span>
                    </div>
                    <div className="npc live">
                      <div className="npc-n live">Step 3 · 연동 완료</div>
                      <div className="npc-name">영상 생성</div>
                      <div className="npc-tool">Seedance 2.0 API</div>
                      <span className="npc-badge live">Active</span>
                    </div>
                    <div className="npc">
                      <div className="npc-n">Step 4</div>
                      <div className="npc-name">자막 생성</div>
                      <div className="npc-tool">Whisper API</div>
                      <span className="npc-badge">Coming Soon</span>
                    </div>
                    <div className="npc">
                      <div className="npc-n">Step 5</div>
                      <div className="npc-name">최종 합성</div>
                      <div className="npc-tool">FFmpeg</div>
                      <span className="npc-badge">Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
