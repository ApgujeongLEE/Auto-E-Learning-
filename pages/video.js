import * as crypto from 'crypto';

// JWT 토큰 생성
function generateToken(accessKey, secretKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { screen_prompt, scene_no, action } = req.body;
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return res.status(500).json({ error: 'Kling API 환경변수가 설정되지 않았습니다.' });
  }

  const token = generateToken(accessKey, secretKey);

  // 영상 생성 요청
  if (action === 'create') {
    try {
      const response = await fetch('https://api-singapore.klingai.com/v1/videos/text2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: 'kling-v1',
          prompt: screen_prompt,
          duration: '5',
          mode: 'pro',
          aspect_ratio: '16:9',
        })
      });

      const data = await response.json();
      if (data.code !== 0) throw new Error(data.message || 'Kling 영상 생성 실패');
      res.status(200).json({ task_id: data.data.task_id, scene_no });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // 영상 상태 확인
  if (action === 'status') {
    const { task_id } = req.body;
    try {
      const response = await fetch(`https://api-singapore.klingai.com/v1/videos/text2video/${task_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.code !== 0) throw new Error(data.message);

      const task = data.data;
      res.status(200).json({
        status: task.task_status,
        video_url: task.task_result?.videos?.[0]?.url || null,
        scene_no
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}
