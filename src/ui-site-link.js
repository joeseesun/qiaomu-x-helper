import { SITE_LINK_ORIGINS } from './site-link.js';
// 网站联动 toggle: permissions are requested from this click, then the background
// registers the bridge script on www.qiaomu.ai/notes/.
export function initSiteLinkUI({ send, notice, demo }) {
  const $ = id => document.getElementById(id);
  const toggle = $('site-link-toggle'), status = $('site-link-status');
  if (!toggle) return;
  const show = enabled => { toggle.checked = enabled; status.textContent = enabled ? '已开启 · 回到随想页刷新后生效' : '未开启 · 随想页只会复制正文并打开发帖页'; };
  const refresh = async () => { if (demo) return show(false); try { show((await send({ type: 'site-link-state' })).enabled); } catch (e) { notice(e.message, true); } };
  $('site-link').ontoggle = () => { if ($('site-link').open) void refresh(); };
  toggle.onchange = async () => {
    toggle.disabled = true;
    try {
      if (toggle.checked) {
        if (!demo && !await chrome.permissions.request({ origins: SITE_LINK_ORIGINS })) { show(false); notice('没有允许访问，网站联动未开启。'); return; }
      } else if (!demo) await chrome.permissions.remove({ origins: SITE_LINK_ORIGINS });
      if (!demo) await send({ type: 'site-link-sync' });
      await refresh();
      if (toggle.checked) notice('已开启。回到 www.qiaomu.ai/notes/ 刷新页面即可使用。');
    } catch (e) { notice(e.message, true); await refresh(); } finally { toggle.disabled = false; }
  };
  void refresh();
}
