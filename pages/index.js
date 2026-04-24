import { useState, useRef } from 'react';
import Head from 'next/head';

const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel — 차분하고 명확한 여성' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella — 친근하고 따뜻한 여성' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam — 신뢰감 있는 남성' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh — 활기차고 젊은 남성' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold — 안정적이고 전문적인 남성' },
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

      <style jsx global>{`
        :root {
          --black:#000;--lg:#f5f5f7;--nb:#1d1d1f;--white:#fff;
          --blue:#0071e3;--lb:#0066cc;--bb:#2997ff;
          --t80:rgba(0,0,0,.8);--t48:rgba(0,0,0,.48);--t24:rgba(0,0,0,.24);--t08:rgba(0,0,0,.08);
          --ds:#272729;--sh:rgba(0,0,0,.22) 3px 5px 30px 0px;
          --df:"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
          --tf:"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;
        }
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;-webkit-font-smoothing:antialiased}
        body{font-family:var(--tf);background:var(--lg);color:var(--nb);overflow:hidden}
        .root{display:flex;flex-direction:column;height:100vh}
        header{height:52px;flex-shrink:0;background:rgba(255,255,255,.88);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--t08);display:flex;align-items:center;padding:0 24px;z-index:100}
        .logo{font-family:var(--df);font-size:17px;font-weight:600;color:var(--nb);letter-spacing:-.374px;margin-right:36px;white-space:nowrap;flex-shrink:0}
        .steps{display:flex;align-items:center;flex:1;overflow:hidden}
        .step{display:flex;align-items:center;gap:7px;padding:5px 12px;border-radius:980px;font-family:var(--tf);font-size:12px;font-weight:400;letter-spacing:-.12px;color:var(--t48);white-space:nowrap;flex-shrink:0;transition:all .2s}
        .step.active{background:var(--blue);color:#fff;font-weight:500}
        .step.done{color:var(--lb)}
        .step-n{width:18px;height:18px;border-radius:50%;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.07);color:var(--t48);flex-shrink:0}
        .step.active .step-n{background:rgba(255,255,255,.25);color:#fff}
        .step.done .step-n{background:rgba(0,102,204,.1);color:var(--lb)}
        .sdiv{width:16px;height:1px;background:var(--t24);flex-shrink:0}
        .app{display:flex;flex:1;min-height:0;overflow:hidden}
        .lp{width:30%;min-width:280px;max-width:360px;flex-shrink:0;background:#fff;border-right:1px solid var(--t08);display:flex;flex-direction:column;overflow:hidden}
        .lp-head{padding:20px 24px 14px;border-bottom:1px solid var(--t08);flex-shrink:0}
        .lp-title{font-family:var(--df);font-size:19px;font-weight:600;letter-spacing:.231px;color:var(--nb);margin-bottom:3px}
        .lp-sub{font-family:var(--tf);font-size:13px;color:var(--t48);letter-spacing:-.224px}
        .lp-body{flex:1;overflow-y:auto;padding:18px 24px}
        .lp-foot{padding:14px 24px;border-top:1px solid var(--t08);flex-shrink:0;background:#fff}
        .opt-label{font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;color:rgba(0,0,0,0.24)}
        .fg{margin-bottom:16px}
        .fg:last-of-type{margin-bottom:0}
        label{display:block;font-family:var(--tf);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--t48);margin-bottom:6px}
        input[type=text],textarea,select{width:100%;background:var(--lg);border:1px solid rgba(0,0,0,.1);border-radius:8px;padding:9px 12px;color:var(--nb);font-family:var(--tf);font-size:14px;font-weight:400;letter-spacing:-.224px;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}
        input[type=text]:focus,textarea:focus,select:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,113,227,.1);background:#fff}
        select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(0,0,0,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px;cursor:pointer}
        textarea{resize:vertical;min-height:76px;line-height:1.5}
        .r2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .hint{font-family:var(--tf);font-size:11px;color:var(--t48);margin-top:4px;line-height:1.4}
        .div{height:1px;background:var(--t08);margin:16px 0}
        .s2-section{}
        .s2-tag{font-family:var(--tf);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);background:rgba(0,113,227,.07);border-radius:980px;padding:2px 8px}
        .s2-label{font-family:var(--df);font-size:15px;font-weight:600;letter-spacing:-.374px;color:var(--nb)}
        .err{background:rgba(255,59,48,.07);border:1px solid rgba(255,59,48,.2);border-radius:8px;padding:10px 14px;font-family:var(--tf);font-size:13px;color:#c0392b;line-height:1.5;margin-top:10px}
        .btn-blue{width:100%;padding:11px 16px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-family:var(--tf);font-size:15px;font-weight:400;letter-spacing:-.374px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s}
        .btn-blue:hover{background:#0077ed}
        .btn-blue:disabled{background:rgba(0,113,227,.35);cursor:not-allowed}
        .btn-dark{width:100%;padding:11px 16px;background:var(--nb);color:#fff;border:none;border-radius:8px;font-family:var(--tf);font-size:15px;font-weight:400;letter-spacing:-.374px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s;margin-top:8px}
        .btn-dark:hover{background:#2d2d2f}
        .btn-dark:disabled{background:rgba(0,0,0,.25);cursor:not-allowed}
        .rp{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
        .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;text-align:center}
        .empty-icon{width:72px;height:72px;border-radius:18px;background:#fff;box-shadow:var(--sh);display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:20px}
        .empty-t{font-family:var(--df);font-size:24px;font-weight:400;letter-spacing:.196px;color:var(--nb);margin-bottom:8px}
        .empty-s{font-family:var(--tf);font-size:15px;color:var(--t48);max-width:320px;line-height:1.6;margin-bottom:32px;letter-spacing:-.374px}
        .guide-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:560px;width:100%}
        .gc{background:#fff;border-radius:12px;padding:18px 14px;box-shadow:var(--sh);text-align:left}
        .gc-step{font-family:var(--tf);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);margin-bottom:6px}
        .gc-t{font-family:var(--df);font-size:13px;font-weight:600;letter-spacing:-.224px;color:var(--nb);margin-bottom:3px}
        .gc-s{font-family:var(--tf);font-size:12px;color:var(--t48);line-height:1.4}
        .loading{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px}
        .ring{width:52px;height:52px;border-radius:50%;border:2px solid var(--t08);border-top-color:var(--blue);animation:spin .85s linear infinite;margin-bottom:20px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .load-t{font-family:var(--df);font-size:20px;font-weight:400;letter-spacing:.231px;color:var(--nb);margin-bottom:6px}
        .load-s{font-family:var(--tf);font-size:14px;color:var(--t48);letter-spacing:-.224px}
        .result{display:flex;flex-direction:column;flex:1;overflow:hidden}
        .r-top{background:#000;padding:20px 28px;flex-shrink:0}
        .r-eyebrow{font-family:var(--tf);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--bb);margin-bottom:5px}
        .r-title{font-family:var(--df);font-size:22px;font-weight:600;line-height:1.14;letter-spacing:.196px;color:#fff;margin-bottom:5px}
        .r-summary{font-family:var(--tf);font-size:14px;color:rgba(255,255,255,.55);margin-bottom:14px;letter-spacing:-.224px}
        .r-stats{display:flex;gap:20px;flex-wrap:wrap}
        .rs{display:flex;flex-direction:column;gap:2px}
        .rs-v{font-family:var(--df);font-size:20px;font-weight:600;letter-spacing:.231px;color:#fff}
        .rs-l{font-family:var(--tf);font-size:11px;color:rgba(255,255,255,.42)}
        .r-actions{padding:10px 28px;background:#fff;border-bottom:1px solid var(--t08);display:flex;align-items:center;gap:4px;flex-wrap:wrap;flex-shrink:0}
        .act{font-family:var(--tf);font-size:13px;color:var(--lb);background:none;border:1px solid rgba(0,0,0,.1);border-radius:980px;padding:5px 12px;cursor:pointer;transition:background .15s;display:inline-flex;align-items:center;gap:3px;letter-spacing:-.224px}
        .act:hover{background:var(--lg)}
        .act.dl{color:var(--blue);border-color:rgba(0,113,227,.2)}
        .act.ghost{color:var(--t48);margin-left:auto}
        .p-row{padding:8px 28px;background:var(--lg);border-bottom:1px solid var(--t08);display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-shrink:0}
        .p-label{font-family:var(--tf);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t48);margin-right:2px}
        .pp{font-family:var(--tf);font-size:11px;padding:3px 10px;border-radius:980px;display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(0,0,0,.1);color:var(--t48);transition:all .3s}
        .pp.done{color:var(--blue);border-color:rgba(0,113,227,.2);background:rgba(0,113,227,.05)}
        .pp.running{color:#b8860b;border-color:rgba(184,134,11,.2);background:rgba(184,134,11,.05)}
        .pdot{width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}
        .scenes-wrap{flex:1;overflow-y:auto;padding:18px 28px 28px}
        .scenes-lbl{font-family:var(--tf);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t48);margin-bottom:12px}
        .sc{background:#fff;border-radius:12px;margin-bottom:8px;overflow:hidden;box-shadow:var(--sh)}
        .sc-h{display:flex;align-items:center;gap:10px;padding:13px 18px;cursor:pointer;border-bottom:1px solid var(--t08);transition:background .15s;user-select:none}
        .sc-h:hover{background:rgba(0,0,0,.01)}
        .sc-num{font-family:var(--tf);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);background:rgba(0,113,227,.07);border-radius:6px;padding:3px 8px;flex-shrink:0}
        .sc-t{font-family:var(--df);font-size:15px;font-weight:600;letter-spacing:-.374px;color:var(--nb);flex:1}
        .sc-d{font-family:var(--tf);font-size:12px;color:var(--t48)}
        .sc-chev{color:var(--t24);font-size:10px;transition:transform .2s;margin-left:4px}
        .sc-body{padding:14px 18px;display:grid;gap:12px}
        .fl{font-family:var(--tf);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:4px}
        .fl.blue{color:var(--blue)}
        .fl.gray{color:var(--t48)}
        .fdot{width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0}
        .ft{font-family:var(--tf);font-size:13px;letter-spacing:-.224px;line-height:1.6;background:var(--lg);border-radius:8px;padding:10px 12px;color:var(--t80)}
        .ft.narr{color:var(--nb)}
        .a-row{display:flex;align-items:center;gap:8px;margin-top:8px}
        .a-lbl{font-family:var(--tf);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t48);white-space:nowrap}
        .a-dl{font-family:var(--tf);font-size:12px;color:var(--lb);text-decoration:none;white-space:nowrap}
        .a-dl:hover{text-decoration:underline}
        .a-gen{font-family:var(--tf);font-size:13px;color:var(--t48);display:flex;align-items:center;gap:6px;margin-top:8px}
        .spin-s{width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(0,0,0,.1);border-top-color:var(--blue);animation:spin .8s linear infinite;flex-shrink:0}
        .np{background:#000;padding:18px 28px;flex-shrink:0}
        .np-t{font-family:var(--df);font-size:15px;font-weight:600;letter-spacing:-.374px;color:#fff;margin-bottom:12px}
        .np-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .npc{background:var(--ds);border-radius:10px;padding:12px}
        .npc.live{background:#0a1f35;border:1px solid rgba(41,151,255,.2)}
        .npc-n{font-family:var(--tf);font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.28);margin-bottom:4px}
        .npc-n.live{color:var(--bb)}
        .npc-name{font-family:var(--df);font-size:13px;font-weight:600;letter-spacing:-.224px;color:#fff;margin-bottom:2px}
        .npc-tool{font-family:var(--tf);font-size:11px;color:rgba(255,255,255,.3);margin-bottom:6px}
        .npc-badge{font-family:var(--tf);font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.1);border-radius:980px;padding:2px 7px;display:inline-block}
        .npc-badge.live{color:var(--bb);border-color:rgba(41,151,255,.3)}
        @media(max-width:860px){.lp{width:35%;min-width:260px}.guide-grid{grid-template-columns:1fr 1fr}.np-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </>
  );
}
