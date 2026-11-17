// KDMaster: WhatsApp form + mobile menu + Supabase invitation/password setup.
const WHATSAPP_NUMBER = "";

// These are public client-side values. Never put a secret/service_role key here.
const SUPABASE_URL = "https://swnlcgloqlmyqvuxlalp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_46uAToOsIg4wIcUTXkFqBw_DYeDztmM";

const form = document.getElementById('lead-form');
const note = document.getElementById('form-note');
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

if (form && note) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabaseClient) {
      note.textContent = 'Не удалось подключиться к сервису заявок. Попробуйте ещё раз позже или позвоните нам.';
      return;
    }

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const service = String(data.get('service') || '').trim();
    const details = String(data.get('message') || '').trim();
    const requestMessage = [
      `Услуга: ${service}`,
      `Комментарий: ${details || 'Не указан'}`
    ].join('\n');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton?.textContent;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Отправляем заявку…';
    }
    note.textContent = 'Отправляем вашу заявку. Пожалуйста, подождите.';

    try {
      // Save the request in Supabase. Public INSERT is allowed by the existing RLS policy.
      const { error: insertError } = await supabaseClient
        .from('requests')
        .insert({ customer_name: name, phone, message: requestMessage });
      if (insertError) throw new Error(`Не удалось сохранить заявку: ${insertError.message}`);

      // Send the email notification through the Edge Function; the Resend key stays server-side.
      const { error: emailError } = await supabaseClient.functions.invoke('send-new-request', {
        body: { name, phone, message: requestMessage }
      });
      if (emailError) {
        note.textContent = 'Заявка сохранена, но уведомление по почте не отправилось. Мы проверим отправку.';
        console.error('KDMaster email notification error:', emailError);
        return;
      }

      note.textContent = 'Спасибо! Заявка отправлена. Мы скоро свяжемся с вами.';
      note.classList.add('success');
      form.reset();
    } catch (error) {
      console.error('KDMaster request error:', error);
      note.textContent = error.message || 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.';
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText || 'Отправить заявку';
      }
    }
  });
}

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.desktop-nav');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const opened = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!opened));
    nav.classList.toggle('mobile-open', !opened);
  });
}

const panel = document.getElementById('auth-panel');
const title = document.getElementById('auth-title');
const description = document.getElementById('auth-description');
const passwordForm = document.getElementById('auth-password-form');
const loginForm = document.getElementById('auth-login-form');
const message = document.getElementById('auth-message');
const loginMessage = document.getElementById('login-message');

function showAuth(mode) {
  if (!panel) return;
  panel.hidden = false;
  if (mode === 'login') {
    title.textContent = 'Вход в админ-панель';
    description.textContent = 'Войдите под своей учётной записью KDMaster.';
    passwordForm.hidden = true;
    loginForm.hidden = false;
  } else {
    title.textContent = 'Задайте свой пароль';
    description.textContent = 'Приглашение принято. Придумайте пароль не короче 8 символов.';
    passwordForm.hidden = false;
    loginForm.hidden = true;
  }
}
document.getElementById('auth-close')?.addEventListener('click', () => { panel.hidden = true; });

let supabaseClient = null;
if (window.supabase?.createClient && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  });
}

async function processInvitation() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hasAuthCode = params.has('code');
  const hasInviteToken = params.has('token_hash') || hashParams.has('access_token');

  if (!supabaseClient) {
    if (hasAuthCode || hasInviteToken) {
      showAuth('password');
      message.textContent = 'Не удалось загрузить модуль авторизации. Обновите страницу и попробуйте ещё раз.';
    }
    return;
  }

  // PKCE invitation links return ?code=... . The Supabase client exchanges it for a session.
  if (hasAuthCode) {
    const { error } = await supabaseClient.auth.exchangeCodeForSession(window.location.href);
    if (error) {
      showAuth('password');
      message.textContent = 'Ссылка приглашения не сработала или уже использована. Попросите администратора отправить новое приглашение.';
      return;
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    showAuth('password');
    return;
  }

  // Support legacy token-hash links if the email template redirects token_hash to this page.
  const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
  const type = params.get('type') || hashParams.get('type') || 'invite';
  if (tokenHash) {
    const { error } = await supabaseClient.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      showAuth('password');
      message.textContent = 'Ссылка приглашения недействительна или уже использована. Попросите новое приглашение.';
      return;
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    showAuth('password');
    return;
  }

  if (params.get('admin') === '1') showAuth('login');
}
processInvitation();

passwordForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.classList.remove('success');
  message.textContent = '';
  if (!supabaseClient) { message.textContent = 'Авторизация не настроена.'; return; }
  const password = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-password-confirm').value;
  if (password.length < 8) { message.textContent = 'Пароль должен содержать минимум 8 символов.'; return; }
  if (password !== confirm) { message.textContent = 'Пароли не совпадают.'; return; }
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) { message.textContent = `Не удалось сохранить пароль: ${error.message}`; return; }
  message.textContent = 'Пароль сохранён. Теперь можно войти в админ-панель.';
  message.classList.add('success');
  passwordForm.hidden = true;
  loginForm.hidden = false;
  title.textContent = 'Пароль успешно создан';
  description.textContent = 'Войдите, используя свой email и новый пароль.';
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.classList.remove('success');
  loginMessage.textContent = '';
  if (!supabaseClient) { loginMessage.textContent = 'Авторизация не настроена.'; return; }
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-login-password').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { loginMessage.textContent = 'Не удалось войти. Проверьте email и пароль.'; return; }
  loginMessage.textContent = 'Вход выполнен. Следующим шагом подключим рабочую админ-панель.';
  loginMessage.classList.add('success');
});
