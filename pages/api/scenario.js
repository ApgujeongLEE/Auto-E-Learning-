export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 환경변수 확인 (디버그용)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' });
  }
  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({ error: `API Key 형식 오류: ${apiKey.substring(0, 10)}...` });
  }

  const { topic, audience, level, objectives, duration, scenes, tone, extra } = req.body;

  if (!topic || !audience || !objectives) {
    return res.status(400).json({ error: '교육 주제, 학습 대상, 학습 목표를 입력해주세요.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: `이러닝 시나리오 작가. 순수 JSON만 출력. 마크다운 금지.

형식: {"title":"","summary":"","scenes":[{"scene_no":1,"chapter":"","duration_sec":0,"screen_prompt":"","narration":""}]}

screen_prompt 규칙 (절대 준수):

[기본 원칙]
- 영어 작성
- 반드시 SHOT 1 → SHOT 2 → SHOT 3 멀티샷 구조
- 강사는 항상 프레임 안에 이미 위치해 있음 (걷거나 등장하는 씬 금지)
- 최대한 실제 영상처럼 photorealistic하게 묘사

[표준 카메라 앵글 - 실제 유튜브/이러닝 기준]
· SHOT A (기본): Eye-level medium shot, chest to head, instructor already in frame
· SHOT B (강조): Medium close-up, shoulders to head, direct eye contact with camera  
· SHOT C (제스처): Medium wide, waist to head, hands and arm gestures clearly visible
· SHOT D (포인트): Close-up on face, intense and clear expression

[멀티샷 조합 예시]
- 설명 장면: SHOT A → SHOT B → SHOT A
- 핵심 강조: SHOT A → SHOT D → SHOT B
- 제스처 설명: SHOT C → SHOT A → SHOT B

[강사 묘사 - 사실감 최대화]
Korean professional instructor, already positioned in frame,
upper body and hands fully visible, business casual attire,
natural skin texture, genuine expression, subtle natural movement,
NOT AI-generated look, real person appearance

[포토리얼리즘 키워드 - 반드시 포함]
photorealistic, shot on Sony FX3 with 85mm f/1.8 lens,
natural skin tones with realistic texture, soft bokeh background,
real studio lighting (key light + fill light + rim light),
natural color grading, no CGI, hyperrealistic

[배경 - 깔끔한 스튜디오]
clean minimal studio background, soft gradient backdrop (light gray or warm white),
subtle depth of field separating subject from background,
professional broadcast-quality setup

[금지 항목]
- instructor walking into frame / entering scene
- dramatic wide establishing shots without instructor
- cartoon / animation / CGI / text overlay
- AI-looking skin / plastic appearance

narration: 자연스러운 한국어 구어체, 강사가 직접 말하는 톤, duration_sec 분량에 맞게 (초당 5~6음절)`,
        messages: [{
          role: 'user',
          content: `교육 주제: ${topic}
학습 대상: ${audience}
수준: ${level}
학습 목표:
${objectives}
영상 길이: ${duration}
장면 수: ${scenes}장면
톤: ${tone}
${extra ? '추가 요청: ' + extra : ''}

JSON으로 시나리오를 작성하세요.

screen_prompt 예시 (이 형식 그대로 따를 것):
"SHOT 1: Eye-level medium shot, Korean professional female instructor already in frame, chest to head visible, speaking directly to camera with warm confident expression, natural hand gesture → SHOT 2: Medium close-up, shoulders to head, instructor making direct eye contact with slight nod emphasizing key point → SHOT 3: Medium wide, waist to head, instructor using open-palm hand gesture to illustrate concept, smooth natural cuts, clean minimal studio with soft warm-white gradient backdrop, Sony FX3 85mm f/1.8, key light + fill light + rim light, photorealistic natural skin texture, soft bokeh background, no CGI, hyperrealistic"

모든 씬의 screen_prompt를 이 예시와 동일한 구조로 작성하되, 각 씬의 narration 내용에 맞게 강사의 행동과 표정을 다르게 묘사하세요.`
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();

    // JSON 파싱 + 잘림 복구
    let scenario;
    try {
      scenario = JSON.parse(raw);
    } catch (_) {
      let fixed = raw;
      const lc = fixed.lastIndexOf('},');
      if (lc > 0) fixed = fixed.slice(0, lc + 1);
      const opens = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
      const arrOpens = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < opens; i++) fixed += '}';
      for (let i = 0; i < arrOpens; i++) fixed += ']';
      scenario = JSON.parse(fixed);
    }

    res.status(200).json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
