import { useState, useRef } from 'react';
import Head from 'next/head';

const VOICES = [
  { id: 'nara', name: 'Nara — 차분하고 명확한 여성' },
  { id: 'nbora', name: 'Bora — 친근하고 따뜻한 여성' },
  { id: 'njiyeon', name: 'Jiyeon — 밝고 활기찬 여성' },
  { id: 'nsunhee', name: 'Sunhee — 부드럽고 따뜻한 여성' },
  { id: 'ndain', name: 'Dain — 젊고 또렷한 여성' },
  { id: 'nminjun', name: 'Minjun — 젊고 활기찬 남성' },
  { id: 'njoonyoung', name: 'Joonyoung — 차분하고 신뢰감 있는 남성' },
  { id: 'njihun', name: 'Jihun — 부드럽고 친근한 남성' },
];

const LOAD_MSGS = [
  '교육 목표를 분석하고 있어요',
  '학습 구조를 설계하는 중이에요',
  '장면별 시나리오를 작성하고 있어요',
  '영상 프롬프트를 최적화하는 중이에요',
  '내레이션 스크립트를 다듬고 있어요',
];

export default function Home() {
  // form
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

  // state
  const [view, setView] = useState('empty'); // empty | loading | result
  const [loadMsg, setLoadMsg] = useState(LOAD_MSGS[0]);
  const [loadTitle, setLoadTitle] = useState('시나리오 작성 중');
  const [scenario, setScenario] = useState(null);
  const [err1, setErr1] = useState('');
  const [err2, setErr2] = useState('');
  const [step, setStep] = useState(1); // 1 or 2
  const [voiceStatus, setVoiceStatus] = useState('wait'); // wait | running | done
  const [audioMap, setAudioMap] = useState({}); // scene_no → url
  const [voiceErrors, setVoiceErrors] = useState({});
  const [generatingScene, setGeneratingScene] = useState(null);
  const [openScenes, setOpenScenes] = useState({});
  const [btn1Loading, setBtn1Loading] = useState(false);
  const [btn2Loading, setBtn2Loading] = useState(false);
  const msgTimer = useRef(null);

  /* ── STEP 1: SCENARIO ── */
  async function generateScenario() {
    if (!topic || !audience || !objectives) { setErr1('교육 주제, 학습 대상, 학습 목표를 모두 입력해주세요.'); return; }
    setErr1('');
    setBtn1Loading(true);
    setLoadTitle('시나리오 작성 중');
    setView('loading');
    let i = 0;
    setLoadMsg(LOAD_MSGS[0]);
    msgTimer.current = setInterval(() => { i = (i + 1) % LOAD_MSGS.length; setLoadMsg(LOAD_MSGS[i]); }, 2200);

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
    } catch (e) {
      setErr1(e.message);
      setView('empty');
    }
    clearInterval(msgTimer.current);
    setBtn1Loading(false);
  }

  /* ── STEP 2: VOICE ── */
  async function generateVoice() {
    if (!scenario) { setErr2('먼저 시나리오를 생성해주세요.'); return; }
    setErr2('');
    setBtn2Loading(true);
    setVoiceStatus('running');
    const newAudioMap = { ...audioMap };
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
        newAudioMap[sc.scene_no] = URL.createObjectURL(blob);
        setAudioMap({ ...newAudioMap });
      } catch (e) {
        newErrors[sc.scene_no] = e.message;
        setVoiceErrors({ ...newErrors });
      }
    }
    setGeneratingScene(null);
    setVoiceStatus('done');
    setBtn2Loading(false);
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
      const a = document.createElement('a'); a.href = url; a.download = `scene_${no}.mp3`; a.click();
    });
  }

  function reset() {
    setScenario(null); setAudioMap({}); setVoiceErrors({});
    setVoiceStatus('wait'); setStep(1); setView('empty');
    setErr1(''); setErr2(''); setOpenScenes({});
  }

  const tot = scenario ? scenario.scenes.reduce((a, c) => a + (c.duration_sec || 0), 0) : 0;
  const chars = scenario ? scenario.scenes.reduce((a, c) => a + (c.narration || '').length, 0) : 0;

  return (
    <>
      <Head><title>EduStudio</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div className="root">

        {/* HEADER */}
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
        </header>

        <div className="app">

          {/* LEFT PANEL */}
          <div className="lp">
            <div className="lp-head">
              <div className="lp-title">콘텐츠 설정</div>
              <div className="lp-sub">교육 정보를 입력하고 AI로 생성하세요</div>
            </div>

            <div className="lp-body">
              <div className="fg">
                <label>교육 주제</label>
                <input type="text" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="예) 힉스필드 Soul · 나노바나나로 Brand Image 만들기"/>
              </div>
              <div className="r2">
                <div className="fg">
                  <label>학습 대상</label>
                  <input type="text" value={audience} onChange={e=>setAudience(e.target.value)} placeholder="예) 전사 디자이너"/>
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
                <input type="text" value={extra} onChange={e=>setExtra(e.target.value)} placeholder="예) 사례 중심, 실습 중심"/>
              </div>

              {err1 && <div className="err">{err1}</div>}

              {/* STEP 2 */}
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
                {btn1Loading ? '생성 중...' : '시나리오 생성하기'}
              </button>
              {step >= 2 && (
                <button className="btn-dark" onClick={generateVoice} disabled={btn2Loading}>
                  {btn2Loading ? `음성 생성 중... (${generatingScene || ''}장면)` : voiceStatus==='done' ? `음성 완성 — ${Object.keys(audioMap).length}/${scenario?.scenes.length}장면` : '음성 생성하기'}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="rp">

            {view === 'empty' && (
              <div className="empty">
                <div className="empty-icon">✦</div>
                <div className="empty-t">시나리오가 여기에 생성됩니다</div>
                <div className="empty-s">왼쪽에서 교육 정보를 입력하고<br/>생성 버튼을 누르면 장면별 시나리오가 자동으로 만들어져요</div>
                <div className="guide-grid">
                  <div className="gc"><div className="gc-step">Step 1</div><div className="gc-t">시나리오 생성</div><div className="gc-s">Claude가 장면별 대본과 영상 지문을 자동 작성</div></div>
                  <div className="gc"><div className="gc-step">Step 2</div><div className="gc-t">음성 생성</div><div className="gc-s">ElevenLabs로 AI 성우 내레이션 자동 생성</div></div>
                  <div className="gc"><div className="gc-step">Step 3–5</div><div className="gc-t">영상 · 합성</div><div className="gc-s">Kling/Veo 영상 생성 후 최종 MP4로 합성</div></div>
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

                {/* dark top */}
                <div className="r-top">
                  <div className="r-eyebrow">시나리오 생성 완료</div>
                  <div className="r-title">{scenario.title}</div>
                  <div className="r-summary">{scenario.summary}</div>
                  <div className="r-stats">
                    <div className="rs"><div className="rs-v">{scenario.scenes.length}</div><div className="rs-l">총 장면</div></div>
                    <div className="rs"><div className="rs-v">{Math.floor(tot/60)}분 {tot%60}초</div><div className="rs-l">예상 시간</div></div>
                    <div className="rs"><div className="rs-v">{chars.toLocaleString()}자</div><div className="rs-l">내레이션</div></div>
                  </div>
                </div>

                {/* actions */}
                <div className="r-actions">
                  <button className="act" onClick={()=>copyText(JSON.stringify(scenario,null,2),'JSON 복사 완료')}>JSON 복사 ›</button>
                  <button className="act" onClick={()=>copyText(scenario.scenes.map(sc=>`[장면 ${sc.scene_no}] ${sc.chapter}\n${sc.narration}`).join('\n\n'),'내레이션 복사 완료')}>내레이션 복사 ›</button>
                  <button className="act" onClick={()=>copyText(scenario.scenes.map(sc=>`[Scene ${sc.scene_no}] ${sc.chapter}\n${sc.screen_prompt}`).join('\n\n'),'영상 프롬프트 복사 완료')}>영상 프롬프트 복사 ›</button>
                  {Object.keys(audioMap).length > 0 && <button className="act dl" onClick={downloadAll}>MP3 전체 다운로드 ↓</button>}
                  <button className="act ghost" onClick={reset}>초기화</button>
                </div>

                {/* pipeline */}
                <div className="p-row">
                  <span className="p-label">진행</span>
                  <span className="pp done"><span className="pdot"/>시나리오 완성</span>
                  <span className={`pp${voiceStatus==='done'?' done':voiceStatus==='running'?' running':''}`}>
                    <span className="pdot"/>
                    {voiceStatus==='done'?`음성 완성 (${Object.keys(audioMap).length}/${scenario.scenes.length})`:voiceStatus==='running'?'음성 생성 중...':'음성 대기'}
                  </span>
                  <span className="pp"><span className="pdot"/>영상 대기</span>
                  <span className="pp"><span className="pdot"/>자막 대기</span>
                  <span className="pp"><span className="pdot"/>합성 대기</span>
                </div>

                {/* scenes */}
                <div className="scenes-wrap">
                  <div className="scenes-lbl">장면별 시나리오</div>
                  {scenario.scenes.map(sc => {
                    const m = Math.floor((sc.duration_sec||0)/60), s = (sc.duration_sec||0)%60;
                    const isOpen = openScenes[sc.scene_no] !== false;
                    const audioUrl = audioMap[sc.scene_no];
                    const voiceErr = voiceErrors[sc.scene_no];
                    const isGen = generatingScene === sc.scene_no;
                    return (
                      <div className="sc" key={sc.scene_no}>
                        <div className="sc-h" onClick={()=>toggleScene(sc.scene_no)}>
                          <span className="sc-num">Scene {sc.scene_no}</span>
                          <span className="sc-t">{sc.chapter}</span>
                          {audioUrl && <span style={{fontSize:11,color:'#0071e3',marginRight:4}}>♪</span>}
                          <span className="sc-d">{m>0?`${m}분 `:''}{s}초</span>
                          <span className="sc-chev" style={{transform:isOpen?'rotate(0)':'rotate(-90deg)'}}>▼</span>
                        </div>
                        {isOpen && (
                          <div className="sc-body">
                            <div>
                              <div className="fl blue"><span className="fdot"/>화면 지문 — Kling / Veo 프롬프트</div>
                              <div className="ft">{sc.screen_prompt}</div>
                            </div>
                            <div>
                              <div className="fl gray"><span className="fdot"/>내레이션 — ElevenLabs TTS</div>
                              <div className="ft narr">{sc.narration}</div>
                              {isGen && <div className="a-gen"><span className="spin-s"/>생성 중...</div>}
                              {audioUrl && (
                                <div className="a-row">
                                  <span className="a-lbl">음성</span>
                                  <audio controls src={audioUrl} style={{flex:1,height:30}}/>
                                  <a className="a-dl" href={audioUrl} download={`scene_${sc.scene_no}.mp3`}>MP3 ↓</a>
                                </div>
                              )}
                              {voiceErr && <div style={{fontSize:12,color:'#c0392b',marginTop:6}}>오류: {voiceErr}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* next pipeline */}
                <div className="np">
                  <div className="np-t">자동화 파이프라인</div>
                  <div className="np-grid">
                    <div className="npc live">
                      <div className="npc-n live">Step 2 · 연동 완료</div>
                      <div className="npc-name">음성 생성</div>
                      <div className="npc-tool">ElevenLabs API</div>
                      <span className="npc-badge live">Active</span>
                    </div>
                    {[{n:3,name:'영상 생성',tool:'Kling · Veo API'},{n:4,name:'자막 생성',tool:'Whisper API'},{n:5,name:'최종 합성',tool:'FFmpeg'}].map(p=>(
                      <div className="npc" key={p.n}>
                        <div className="npc-n">Step {p.n}</div>
                        <div className="npc-name">{p.name}</div>
                        <div className="npc-tool">{p.tool}</div>
                        <span className="npc-badge">Coming Soon</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>


      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
