import test from 'node:test';
import assert from 'node:assert/strict';
import { siteMediaURL, validShare, pickForX, pickForXhs, xhsDraft, syncBridge, fetchSiteMedia, BRIDGE_SCRIPT, SITE_LINK_ORIGINS } from '../src/site-link.js';
import { senderContext } from '../src/context.js';

const file = (type, size = 1000, name = 'a') => ({ type, size, name });
const media = path => `https://blog.qiaomu.ai/api/images/${path}`;

test('only qmblog uploads may be fetched for a note', () => {
  assert.equal(siteMediaURL(media('image/2026/10/abc-a.png')), media('image/2026/10/abc-a.png'));
  for (const bad of ['https://evil.test/api/images/a.png', 'http://blog.qiaomu.ai/api/images/a.png', 'https://blog.qiaomu.ai/admin', 'https://user:pw@blog.qiaomu.ai/api/images/a.png', 'https://blog.qiaomu.ai.evil.test/api/images/a.png', 'javascript:alert(1)', '']) {
    assert.equal(siteMediaURL(bad), '', bad);
  }
});

test('share requests are validated and foreign media dropped', () => {
  const share = validShare({ target: 'x', text: '  hi\r\nthere ', media: [media('a.png'), 'https://evil.test/x.png', media('a.png')] });
  assert.deepEqual(share, { target: 'x', text: 'hi\nthere', media: [media('a.png')] });
  assert.throws(() => validShare({ target: 'weibo', text: 'x' }));
  assert.throws(() => validShare({ target: 'xhs', text: ' ', media: ['https://evil.test/a.png'] }));
});

test('X gets up to four images, or one GIF or video', () => {
  const imgs = Array.from({ length: 6 }, () => file('image/png'));
  assert.equal(pickForX(imgs).use.length, 4);
  assert.equal(pickForX(imgs).skipped, 2);
  const mixed = pickForX([file('video/mp4'), file('image/jpeg')]);
  assert.deepEqual(mixed.use.map(f => f.type), ['image/jpeg']);
  assert.equal(mixed.skipped, 1);
  assert.deepEqual(pickForX([file('video/mp4'), file('image/gif')]).use.map(f => f.type), ['video/mp4']);
  assert.equal(pickForX([file('image/png', 6 * 1024 * 1024)]).use.length, 0);
  assert.equal(pickForX([file('application/pdf')]).use.length, 0);
});

test('小红书 gets images only, at most 18', () => {
  const picked = pickForXhs([...Array.from({ length: 20 }, () => file('image/jpeg')), file('video/mp4'), file('image/gif')]);
  assert.equal(picked.use.length, 18);
  assert.equal(picked.skipped, 4);
});

test('小红书 title is the first line, cut to 20 characters', () => {
  assert.deepEqual(xhsDraft('\n  第一行标题 \n正文'), { title: '第一行标题', body: '第一行标题 \n正文' });
  const long = xhsDraft('这是一个超过二十个字的很长很长很长很长的标题行啊\n正文');
  assert.equal([...long.title].length, 20);
  assert.ok(long.title.endsWith('…'));
  assert.equal([...xhsDraft('字'.repeat(1200)).body].length, 1000);
});

test('the bridge script follows the permission', async () => {
  let granted = false, registered = [];
  const api = {
    permissions: { contains: async ({ origins }) => granted && origins.every(o => SITE_LINK_ORIGINS.includes(o)) },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => registered.filter(s => ids.includes(s.id)),
      registerContentScripts: async scripts => { registered.push(...scripts); },
      unregisterContentScripts: async ({ ids }) => { registered = registered.filter(s => !ids.includes(s.id)); }
    }
  };
  assert.deepEqual(await syncBridge(api), { enabled: false });
  assert.equal(registered.length, 0);
  granted = true;
  await syncBridge(api); await syncBridge(api);
  assert.deepEqual(registered.map(s => s.id), [BRIDGE_SCRIPT.id]);
  assert.deepEqual(BRIDGE_SCRIPT.matches, ['https://www.qiaomu.ai/notes/*']);
  granted = false;
  await syncBridge(api);
  assert.equal(registered.length, 0);
});

test('fetched media keeps its type and readable name', async () => {
  const fetcher = async url => new Response(new Blob(['x']), { headers: { 'content-type': url.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' } });
  const [img, video] = await fetchSiteMedia([media('image/2026/10/0123456789abcdef-photo.png'), media('video/2026/10/clip.mp4')], fetcher);
  assert.equal(img.type, 'image/png');
  assert.equal(img.name, 'photo.png');
  assert.equal(video.type, 'video/mp4');
  await assert.rejects(fetchSiteMedia([media('a.png')], async () => new Response('', { status: 404 })));
});

test('www notes and 小红书 publish pages get their own sender contexts', () => {
  const runtime = { id: 'ours', getURL: p => `chrome-extension://ours/${p}` };
  const base = { id: 'ours', tab: { id: 1 }, frameId: 0 };
  assert.equal(senderContext({ ...base, url: 'https://www.qiaomu.ai/notes/' }, runtime), 'site');
  assert.equal(senderContext({ ...base, url: 'https://creator.xiaohongshu.com/publish/publish' }, runtime), 'xhs');
  for (const url of ['https://www.qiaomu.ai/about/', 'http://www.qiaomu.ai/notes/', 'https://qiaomu.ai/notes/', 'https://www.qiaomu.ai.evil.test/notes/', 'https://xiaohongshu.com/']) {
    assert.equal(senderContext({ ...base, url }, runtime), 'none', url);
  }
  assert.equal(senderContext({ ...base, frameId: 2, url: 'https://www.qiaomu.ai/notes/' }, runtime), 'none');
});
