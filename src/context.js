export function senderContext(sender, runtime) {
  if (sender.id !== runtime.id) return 'none';
  try {
    const url = new URL(sender.url || '');
    const ui = new URL(runtime.getURL('ui.html'));
    if (url.protocol === ui.protocol && url.host === ui.host && ['/ui.html','/settings.html','/write.html'].includes(url.pathname)) return 'admin';
    if (url.protocol === 'https:' && ['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(url.hostname) && sender.tab && sender.frameId === 0) return 'content';
    // 网站联动: the notes page on www.qiaomu.ai and the 小红书 publish page this extension opened.
    if (url.protocol === 'https:' && url.hostname === 'www.qiaomu.ai' && url.pathname.startsWith('/notes/') && sender.tab && sender.frameId === 0) return 'site';
    if (url.protocol === 'https:' && url.hostname === 'creator.xiaohongshu.com' && sender.tab && sender.frameId === 0) return 'xhs';
  } catch {}
  return 'none';
}
