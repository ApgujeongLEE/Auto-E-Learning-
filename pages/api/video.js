export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { screen_prompt, scene_no, action, task_id, image_url } = req.body;
  const apiKey = process.env.PIAPI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'PIAPI_API_KEY 환경변수가 설정되지 않았습니다.' });

  function findVideoUrl(obj, depth = 0) {
    if (!obj || depth > 5) return null;
    if (typeof obj === 'string' && obj.startsWith('http') && (obj.includes('.mp4') || obj.includes('video'))) return obj;
    const keys = ['video_url', 'url', 'video', 'resource', 'download_url', 'file_url'];
    for (const k of keys) {
      if (obj[k] && typeof obj[k] === 'string' && obj[k].startsWith('http')) return obj[k];
    }
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'object') {
        const found = findVideoUrl(obj[k], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  // 영상 생성 (텍스트 또는 이미지→영상)
  if (action === 'create') {
    try {
      const input = image_url ? {
        // 이미지→영상 모드
        prompt: screen_prompt,
        mode: 'first_last_frames',
        image_urls: [image_url],
        duration: 10,
        aspect_ratio: '16:9',
      } : {
        // 텍스트→영상 모드
        prompt: screen_prompt,
        mode: 'text_to_video',
        duration: 10,
        aspect_ratio: '16:9',
      };

      const response = await fetch('https://api.piapi.ai/api/v1/task', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'seedance', task_type: 'seedance-2-fast', input })
      });
      const data = await response.json();
      console.log('[Seedance] create:', JSON.stringify(data));
      if (data.code !== 200) throw new Error(data.message || JSON.stringify(data));
      return res.status(200).json({ task_id: data.data.task_id, scene_no });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 상태 확인
  if (action === 'status') {
    try {
      const response = await fetch(`https://api.piapi.ai/api/v1/task/${task_id}`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await response.json();
      if (data.code !== 200) throw new Error(data.message || '상태 확인 실패');
      const task = data.data;
      const status = task.status;
      if (status === 'completed') console.log('[Seedance] COMPLETED:', JSON.stringify(task));
      const videoUrl = findVideoUrl(task.output);
      return res.status(200).json({
        status: status === 'completed' ? 'succeed' : status,
        video_url: videoUrl,
        raw_status: status,
        raw_output: task.output,
        scene_no,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 수동 복구
  if (action === 'retrieve') {
    try {
      const response = await fetch(`https://api.piapi.ai/api/v1/task/${task_id}`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await response.json();
      const task = data.data;
      console.log('[Seedance] retrieve:', JSON.stringify(task));
      const videoUrl = findVideoUrl(task.output);
      return res.status(200).json({ status: task.status, video_url: videoUrl, raw_output: task.output });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: '잘못된 action 값입니다.' });
}
