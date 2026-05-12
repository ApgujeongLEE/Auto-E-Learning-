export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { screen_prompt, scene_no, action, task_id } = req.body;
  const apiKey = process.env.PIAPI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'PIAPI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  // 영상 생성 요청
  if (action === 'create') {
    try {
      const response = await fetch('https://api.piapi.ai/api/v1/task', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'seedance',
          task_type: 'seedance-2-fast',
          input: {
            prompt: screen_prompt,
            mode: 'text_to_video',
            duration: 5,
            aspect_ratio: '16:9',
          }
        })
      });

      const data = await response.json();
      console.log('Seedance create response:', JSON.stringify(data));

      if (data.code !== 200) throw new Error(data.message || `Seedance 오류: ${JSON.stringify(data)}`);
      return res.status(200).json({ task_id: data.data.task_id, scene_no });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 영상 상태 확인
  if (action === 'status') {
    try {
      const response = await fetch(`https://api.piapi.ai/api/v1/task/${task_id}`, {
        headers: { 'x-api-key': apiKey }
      });

      const data = await response.json();
      console.log('Seedance status response:', JSON.stringify(data));

      if (data.code !== 200) throw new Error(data.message || '상태 확인 실패');

      const task = data.data;
      const status = task.status; // pending / processing / completed / failed

      const videoUrl =
        task.output?.video_url ||
        task.output?.works?.[0]?.video?.resource ||
        task.output?.works?.[0]?.video?.url ||
        null;

      return res.status(200).json({
        status: status === 'completed' ? 'succeed' : status,
        video_url: videoUrl,
        raw_status: status,
        scene_no,
        debug: { output: task.output, error: task.error }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: '잘못된 action 값입니다.' });
}
