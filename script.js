// Перед публикацией укажите номер WhatsApp в формате 79991234567.
const WHATSAPP_NUMBER = "";
const form = document.getElementById('lead-form');
const note = document.getElementById('form-note');
document.getElementById('year').textContent = new Date().getFullYear();
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const message = [
    'Здравствуйте! Хочу обсудить ремонт.',
    `Имя: ${data.get('name')}`,
    `Телефон: ${data.get('phone')}`,
    `Услуга: ${data.get('service')}`,
    `Комментарий: ${data.get('message') || 'Не указан'}`
  ].join('\n');
  if (!WHATSAPP_NUMBER) {
    note.textContent = 'Форма готова. Для отправки заявок добавьте ваш номер WhatsApp в файле script.js — инструкция есть в README.';
    return;
  }
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.desktop-nav');
menuButton.addEventListener('click', () => {
  const opened = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!opened));
  if (!nav) return;
  nav.classList.toggle('mobile-open', !opened);
});
