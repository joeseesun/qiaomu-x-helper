// Injected into the 小红书 creator publish page that the extension opened for a note.
// Uploads the images, fills the title and body, and stops: the user presses 发布.
import { chunkBytes } from './posts.js';

const send = async m => { const r = await chrome.runtime.sendMessage(m); if (!r?.ok) throw Error(r?.error || '乔木 X 助手已更新，请重新点「发到小红书」。'); return r.data; };
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 20000, step = 200) { const end = Date.now() + timeout; for (;;) { const v = fn(); if (v) return v; if (Date.now() > end) return null; await pause(step); } }
const visible = el => !!el && el.getClientRects().length > 0;
const textOf = el => (el.textContent || '').replace(/\s+/g, '');

let note = null;
function toast(text, error = false) {
  note?.remove(); note = document.createElement('div'); note.setAttribute('role', 'status'); note.textContent = text;
  note.style.cssText = `position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translateX(-50%);max-width:min(520px,calc(100vw - 32px));padding:10px 14px;border-radius:10px;font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:${error ? '#7a2e12' : '#0f1419'};color:#fff;box-shadow:0 8px 24px #0003`;
  document.body.append(note); setTimeout(() => note?.remove(), 9000);
}

// The page may open on 上传视频; switch to the 图文 tab by its label.
function imageTab() {
  return [...document.querySelectorAll('[class*="tab"], span, div')].find(el => visible(el) && el.children.length <= 2 && textOf(el) === '上传图文');
}
function imageInput() {
  return [...document.querySelectorAll('input[type="file"]')].find(input => /image|png|jpe?g|webp/i.test(input.accept || ''));
}
function titleInput() {
  return [...document.querySelectorAll('input, textarea')].find(el => visible(el) && /标题/.test(el.placeholder || ''));
}
function bodyEditor() {
  const editors = [...document.querySelectorAll('[contenteditable="true"]')].filter(visible);
  return editors.find(el => /ProseMirror|tiptap|ql-editor|editor/i.test(el.className)) || editors[0];
}

function setValue(input, value) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function pasteText(editor, text) {
  editor.focus({ preventScroll: true }); await pause(0);
  const data = new DataTransfer(); data.setData('text/plain', text);
  const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
  editor.dispatchEvent(paste); await pause(80);
  const has = () => (editor.textContent || '').replace(/\s+/g, '').includes(text.replace(/\s+/g, '').slice(0, 30));
  if (!has()) document.execCommand('insertText', false, text);
  await pause(50);
  return has();
}

async function fetchFile(meta) {
  const parts = []; let offset = 0;
  for (;;) { const r = await send({ type: 'xhs-media-chunk', index: meta.index, offset }); parts.push(chunkBytes(r.data)); offset = r.next; if (r.done) break; }
  return new File(parts, meta.name || `image-${meta.index + 1}.png`, { type: meta.type });
}

async function fill() {
  let job;
  try { job = await send({ type: 'xhs-fill-pending' }); } catch { return; }
  if (!job) return;
  try {
    if (/login/i.test(location.pathname) || document.querySelector('input[type="password"], [class*="login"] input')) throw Error('请先登录小红书创作服务平台，再回随想页点一次「发到小红书」。');
    if (job.media.length) {
      const tab = imageTab(); if (tab && !imageInput()) { tab.click(); await pause(400); }
      const input = await until(imageInput);
      if (!input) throw Error('没有找到小红书的上传图片按钮，正文已复制，请手动上传图片后粘贴。');
      toast(`正在上传 ${job.media.length} 张图片…`);
      const files = []; for (const m of job.media) files.push(await fetchFile(m));
      const data = new DataTransfer(); for (const f of files) data.items.add(f);
      input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // The title and body fields appear once the first image is accepted.
    const title = await until(titleInput, 30000);
    if (title && job.title) setValue(title, job.title);
    const editor = await until(bodyEditor, 15000);
    const bodyOk = editor && job.body ? await pasteText(editor, job.body) : !job.body;
    await send({ type: 'xhs-filled' });
    if (!title || !bodyOk) toast('图片已添加。标题或正文没填上，正文已在剪贴板，请手动粘贴。', true);
    else toast(job.skipped ? `已填入，${job.skipped} 个附件不是图片，未上传。检查后点「发布」。` : '已填入。检查无误后点「发布」。');
  } catch (e) {
    toast(e.message, true);
    void send({ type: 'xhs-filled', error: e.message }).catch(() => {});
  }
}

void fill();
