window.CMS_MANUAL_INIT = true;
window.CMS_RELEASE_VERSION = '3.17.1';
document.body.dataset.mobilePane = 'edit';
document.querySelectorAll('[data-editor-view]').forEach(button => {
  button.addEventListener('click', () => {
    document.body.dataset.mobilePane = button.dataset.editorView;
    document.querySelectorAll('[data-editor-view]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
  });
});

async function openWritingDesk() {
  const status = document.getElementById('setup-status');
  try {
    const response = await fetch('/api/cms-status', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok || !(await response.json()).enabled) {
      status.textContent = 'Sign-in is not configured yet. Complete the one-time GitHub OAuth setup in the guide. No editing or publishing is enabled.';
      return;
    }
    const configResponse = await fetch('/admin/config.yml', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('Configuration unavailable');
    const config = await configResponse.json();
    const script = document.createElement('script');
    script.src = '/admin/vendor/decap-cms.js';
    script.onload = () => {
      const editor = document.createElement('script');
      editor.src = '/admin/editor.js';
      editor.onload = () => {
        window.CMS.init({ config: { ...config, load_config_file: false } });
        document.getElementById('cms-setup').hidden = true;
      };
      editor.onerror = () => { status.textContent = 'The editor could not load. Refresh the page or use GitHub from the guide.'; };
      document.head.append(editor);
    };
    script.onerror = () => { status.textContent = 'The editor could not load. Refresh the page or use GitHub from the guide.'; };
    document.head.append(script);
  } catch {
    status.textContent = 'Secure sign-in is unavailable. The blog is unaffected. Follow the GitHub publishing instructions in the guide or try again later.';
  }
}

void openWritingDesk();
