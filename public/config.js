// ==============================================================================
// StreamX Central Configuration & Global Theme / Branding Engine
// Change app name or settings here, and it will reflect across the entire site!
// ==============================================================================

const APP_CONFIG = {
  name: 'StreamX Tamil',
  shortName: 'StreamX',
  tagline: 'HD Tamil Serials & Shows',
  version: '2.5.0',
  defaultTheme: 'dark',
  apiBase: '/api'
};

// Expose globally
window.APP_CONFIG = APP_CONFIG;

// Apply app brand name dynamically to all marked elements and document title
function applyAppBranding() {
  // Update elements with data attributes
  document.querySelectorAll('[data-app-name]').forEach(el => {
    el.textContent = APP_CONFIG.name;
  });

  document.querySelectorAll('[data-app-shortname]').forEach(el => {
    el.textContent = APP_CONFIG.shortName;
  });

  document.querySelectorAll('[data-app-tagline]').forEach(el => {
    el.textContent = APP_CONFIG.tagline;
  });

  // Dynamic brand icon initials (e.g. SX)
  const initials = APP_CONFIG.shortName.replace(/[^A-Z]/g, '').slice(0, 2) || APP_CONFIG.shortName.slice(0, 2).toUpperCase();
  document.querySelectorAll('.brand-icon').forEach(icon => {
    icon.textContent = initials;
  });

  // Dynamic brand title with stylish highlight span
  const short = APP_CONFIG.shortName;
  const match = short.match(/^(.*?)(\S{1,2})$/) || [null, short, ''];
  const formattedTitle = `${(match[1] || '').toUpperCase()}<span>${(match[2] || '').toUpperCase()}</span>`;
  document.querySelectorAll('.brand-title').forEach(title => {
    title.innerHTML = formattedTitle;
  });

  document.querySelectorAll('.brand-tag').forEach(tag => {
    tag.textContent = APP_CONFIG.tagline;
  });

  // Clean document title if it contains legacy name
  if (document.title.includes('Tamildhool')) {
    document.title = document.title.replace('Tamildhool', APP_CONFIG.shortName);
  }
}

// Helper to set page title consistently
function setPageTitle(pageName) {
  if (pageName) {
    document.title = `${pageName} - ${APP_CONFIG.shortName}`;
  } else {
    document.title = `${APP_CONFIG.name} - ${APP_CONFIG.tagline}`;
  }
}
window.setPageTitle = setPageTitle;

// --------------------------------------------------------
// Theme Switcher (Dark & Light Mode)
// --------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('streamx_theme') || APP_CONFIG.defaultTheme || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('streamx_theme', next);
  updateThemeButton(next);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    if (theme === 'light') {
      btn.innerHTML = `<i class="fa-solid fa-moon"></i> <span class="theme-btn-text">Dark Mode</span>`;
      btn.title = 'Switch to Dark Mode';
    } else {
      btn.innerHTML = `<i class="fa-solid fa-sun"></i> <span class="theme-btn-text">Light Mode</span>`;
      btn.title = 'Switch to Light Mode';
    }
  }
}

// Auto-run on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyAppBranding();
});
