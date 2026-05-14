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
        system: `당신은 이러닝 시나리오 전문 작가입니다. 반드시 순수 JSON만 출력하세요. 마크다운 없이.

출력 형식:
{"title":"","summary":"","scenes":[{"scene_no":1,"chapter":"","duration_sec":0,"screen_prompt":"","narration":""}]}

screen_prompt 작성 규칙 (Seedance AI 영상 생성 최적화):
1. 반드시 영어로 작성
2. 기본 구조: [카메라 구도], [피사체/행동], [배경], [조명/분위기], [스타일]
3. 강사 장면 기본 템플릿:
   "Medium shot of a professional Korean female/male instructor, upper body and hands visible, speaking directly to camera with confident and warm expression, [배경 묘사], soft studio lighting with subtle rim light, professional educational video style, cinematic 4K, shallow depth of field"
4. 장면 유형별 구도:
   - 인트로/아웃트로: Wide shot → Medium shot으로 전환되는 강사 등장
   - 개념 설명: Medium shot, 강사가 손짓으로 강조하며 설명
   - 실습/시연: Over-the-shoulder shot, 화면을 가리키며 설명
   - 핵심 정리: Close-up on face and hands, 진지하고 명확한 표정
5. 강사 묘사: Korean instructor, professional attire, natural makeup, confident posture
6. 배경 옵션: modern studio background / clean office / soft bokeh background
7. 금지: cartoon, animation, text overlay, watermark

narration 작성 규칙:
- 자연스러운 한국어 구어체
- 강사가 직접 시청자에게 말하는 1인칭 톤
- 학습 대상 수준에 맞는 용어 사용`,
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

위 정보로 이러닝 시나리오를 JSON으로 작성하세요.

screen_prompt 필수 조건:
- 한국인 강사(상반신+손이 보이는 미디엄샷)가 메인으로 등장
- 각 장면의 교육 내용에 맞게 강사의 행동/표정/손짓을 구체적으로 묘사
- Seedance AI에 최적화된 영어 프롬프트
- 장면마다 카메라 구도, 배경, 조명, 분위기를 명시

narration 필수 조건:
- 강사가 직접 시청자에게 말하는 자연스러운 한국어
- 해당 장면 duration_sec에 맞는 분량 (초당 약 5~6음절)
- ${tone} 톤 유지`
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
