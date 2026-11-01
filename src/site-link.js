// 网站联动: www.qiaomu.ai/notes/ hands a note (text + media) to this extension, which
// fills X's composer or 小红书's publish page. The user still presses Post there.
// All three origins are optional host permissions granted from the settings page,
// so store users are not asked for anything new on update.
import { MEDIA_RULES, mediaKind } from './posts.js';

export const SITE_ORIGIN = 'https://www.qiaomu.ai';
export const SITE_MEDIA_ORIGIN = 'https://blog.qiaomu.ai';
export const XHS_ORIGIN = 'https://creator.xiaohongshu.com';
export const SITE_LINK_ORIGINS = [`${SITE_ORIGIN}/*`, `${SITE_MEDIA_ORIGIN}/*`, `${XHS_ORIGIN}/*`];
export const BRIDGE_SCRIPT = { id: 'qiaomu-site-bridge', matches: [`${SITE_ORIGIN}/notes/*`], js: ['site-bridge.js'], runAt: 'document_idle', allFrames: false };
// Opens the 图文 tab of the publish page.
export const XHS_PUBLISH_URL = `${XHS_ORIGIN}/publish/publish?from=menu&target=image`;
export const XHS_TITLE_MAX = 20;
export const XHS_TEXT_MAX = 1000;
export const XHS_IMAGE_MAX = 18;
const XHS_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const XHS_IMAGE_BYTES = 20 * 1024 * 1024;
const MEDIA_PATH = /^\/api\/images\/[^?#]+$/;

// Only uploads stored by qmblog may be fetched, so a page cannot point the extension elsewhere.
export function siteMediaURL(value) {
  try {
    const url = new URL(String(value || ''));
    return url.origin === SITE_MEDIA_ORIGIN && MEDIA_PATH.test(url.pathname) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function validShare(message) {
  const target = message?.target;
  if (target !== 'x' && target !== 'xhs') throw Error('不支持的发布平台。');
  const text = String(message.text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 25000);
  const media = (Array.isArray(message.media) ? message.media : []).slice(0, 20).map(siteMediaURL).filter(Boolean);
  if (!text && !media.length) throw Error('这条随想是空的。');
  return { target, text, media: [...new Set(media)] };
}

// X takes up to 4 images, or exactly one GIF or video.
export function pickForX(files) {
  const images = files.filter(f => mediaKind(f.type) === 'image' && f.size <= MEDIA_RULES.image.max);
  if (images.length) return { use: images.slice(0, 4), skipped: files.length - Math.min(images.length, 4) };
  const single = files.find(f => { const kind = mediaKind(f.type); return kind && kind !== 'image' && f.size <= MEDIA_RULES[kind].max; });
  return { use: single ? [single] : [], skipped: files.length - (single ? 1 : 0) };
}

// 小红书 图文 notes take images only.
export function pickForXhs(files) {
  const images = files.filter(f => XHS_IMAGE_TYPES.includes(f.type) && f.size <= XHS_IMAGE_BYTES).slice(0, XHS_IMAGE_MAX);
  return { use: images, skipped: files.length - images.length };
}

// 小红书 titles hold 20 characters; use the note's first line.
export function xhsDraft(text) {
  const lines = String(text || '').split('\n');
  const first = lines.find(line => line.trim())?.trim() || '';
  const chars = [...first];
  const title = chars.length > XHS_TITLE_MAX ? chars.slice(0, XHS_TITLE_MAX - 1).join('') + '…' : first;
  const body = [...String(text || '').trim()].slice(0, XHS_TEXT_MAX).join('');
  return { title, body };
}

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mov: 'video/quicktime' };
function typeOf(response, url) {
  const header = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (header && header !== 'application/octet-stream') return header;
  return TYPES[new URL(url).pathname.split('.').pop()?.toLowerCase()] || header;
}

const MAX_FETCH = 512 * 1024 * 1024;
export async function fetchSiteMedia(urls, fetcher = fetch) {
  const files = [];
  for (const url of urls) {
    const response = await fetcher(url, { credentials: 'omit', redirect: 'error' });
    if (!response.ok) throw Error(`有一个附件下载失败（${response.status}）。`);
    const blob = await response.blob();
    if (blob.size > MAX_FETCH) throw Error('附件太大，无法转交。');
    const type = typeOf(response, url);
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'media').replace(/^[0-9a-f]{16}-/, '').slice(0, 120);
    files.push(new File([blob], name, { type }));
  }
  return files;
}

export async function siteLinkEnabled(permissions = chrome.permissions) {
  return permissions.contains({ origins: SITE_LINK_ORIGINS });
}

// Registered scripts persist across browser restarts; this keeps them matching the permission.
export async function syncBridge(api = chrome) {
  const enabled = await siteLinkEnabled(api.permissions);
  const registered = (await api.scripting.getRegisteredContentScripts({ ids: [BRIDGE_SCRIPT.id] })).length > 0;
  if (enabled && !registered) await api.scripting.registerContentScripts([BRIDGE_SCRIPT]);
  if (!enabled && registered) await api.scripting.unregisterContentScripts({ ids: [BRIDGE_SCRIPT.id] });
  return { enabled };
}
