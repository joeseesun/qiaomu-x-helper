// Registered on www.qiaomu.ai/notes/ only after the user turns on 网站联动 in settings.
// The page posts { source:'qiaomu-notes', type:'share', requestId, payload } to itself;
// this script relays it to the background and posts the result back. Nothing is published.
const IN = 'qiaomu-notes', OUT = 'qiaomu-x-helper';
const reply = data => window.postMessage({ source: OUT, ...data }, location.origin);
const announce = () => reply({ type: 'ready', version: chrome.runtime.getManifest().version });

window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const m = event.data;
  if (!m || m.source !== IN) return;
  if (m.type === 'ping') { announce(); return; }
  if (m.type !== 'share' || typeof m.requestId !== 'string') return;
  const p = m.payload || {};
  try {
    const r = await chrome.runtime.sendMessage({ type: 'site-share', target: p.target, text: p.text, media: p.media });
    reply({ type: 'share-result', requestId: m.requestId, ok: !!r?.ok, error: r?.error || '', data: r?.data || null });
  } catch {
    reply({ type: 'share-result', requestId: m.requestId, ok: false, error: '乔木 X 助手已更新，请刷新这个页面再试。' });
  }
});

announce();
