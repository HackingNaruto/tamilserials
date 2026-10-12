// StreamX Tamil - Frontend Application Engine
const API_BASE = '/api';

// ---- Helpers ----
async function apiGet(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    return null;
  }
}

// Clean Cloudflare Security Loader (No third-party site mentions)
function showLoader(container, msg = 'Connecting to Cloudflare Secure Network...') {
  if (!container) return;
  container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--text-muted);">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(246,130,31,0.12);margin-bottom:12px;border:1px solid rgba(246,130,31,0.25);">
      <i class="fa-solid fa-shield-halved fa-spin" style="color:#f6821f;font-size:1.8rem;"></i>
    </div>
    <p style="margin-top:6px;font-size:0.95rem;font-weight:600;color:var(--text-main);">${msg}</p>
    <p style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;"><i class="fa-solid fa-cloud" style="color:#f6821f;"></i> Cloudflare Protected Stream Network</p>
  </div>`;
}

function showError(container, msg = 'Failed to load stream data') {
  if (!container) return;
  container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:#e55;">
    <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
    <p style="margin-top:14px;">${msg}</p>
    <a href="javascript:location.reload()" class="btn btn-primary" style="margin-top:12px;">Retry</a>
  </div>`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  updateNavHistoryIndicator();
  if (document.getElementById('episodesContainer')) loadHomePage();
  if (document.getElementById('watchPlayerContainer')) initWatchPage();
  if (document.getElementById('showEpisodesContainer')) initShowPage();
});

// ==================================================================
// 0. WATCH HISTORY ENGINE
// ==================================================================
const WATCH_HISTORY_KEY = 'streamx_watch_history';

function getWatchHistory() {
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveToWatchHistory(ep, currentTime, duration) {
  if (!ep || !currentTime || currentTime < 5) return;
  try {
    let history = getWatchHistory();
    const epSlug = ep.id || ep.slug || '';
    const progress = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

    history = history.filter(item => item.id !== epSlug && item.slug !== epSlug);

    let pathToken = '';
    if (ep.url) {
      const cleanRel = ep.url.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
      try { pathToken = btoa(cleanRel); } catch(e) {}
    }

    history.unshift({
      id: epSlug,
      slug: epSlug,
      title: ep.title || 'Tamil Serial Episode',
      thumbnail: ep.thumbnail || '/api/image',
      url: ep.url || '',
      token: pathToken,
      currentTime: Math.round(currentTime),
      duration: Math.round(duration || 0),
      progress: progress,
      updatedAt: Date.now()
    });

    if (history.length > 20) history = history.slice(0, 20);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));

    updateNavHistoryIndicator();
  } catch (e) {
    console.error('History save error:', e);
  }
}

// Watch History Undo Cache
let lastRemovedHistoryItem = null;
let lastRemovedHistoryIndex = -1;
let historyUndoTimeout = null;

window.removeFromWatchHistory = function(epSlug, event) {
  if (event) event.stopPropagation();
  try {
    let history = getWatchHistory();
    const itemIndex = history.findIndex(item => item.id === epSlug || item.slug === epSlug);
    if (itemIndex === -1) return;

    lastRemovedHistoryItem = history[itemIndex];
    lastRemovedHistoryIndex = itemIndex;

    history.splice(itemIndex, 1);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    renderContinueWatchingSection();

    // Show interactive toast with 5s Undo button
    showToastWithUndo(
      `Removed "${(lastRemovedHistoryItem.title || 'Episode').split('|')[0].trim()}" from Watch History`,
      'fa-trash-can',
      () => {
        undoRemoveFromWatchHistory();
      },
      5000
    );
  } catch (e) {
    console.error('Remove history error:', e);
  }
};

window.undoRemoveFromWatchHistory = function() {
  if (!lastRemovedHistoryItem) return;
  try {
    let history = getWatchHistory();
    // Re-insert at original index or top
    if (lastRemovedHistoryIndex >= 0 && lastRemovedHistoryIndex <= history.length) {
      history.splice(lastRemovedHistoryIndex, 0, lastRemovedHistoryItem);
    } else {
      history.unshift(lastRemovedHistoryItem);
    }
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    renderContinueWatchingSection();
    showToast('Episode restored to Watch History', 'fa-rotate-left');
    lastRemovedHistoryItem = null;
    lastRemovedHistoryIndex = -1;
  } catch (e) {
    console.error('Undo error:', e);
  }
};

let clearedWatchHistoryBackup = null;

window.clearWatchHistory = function() {
  const current = getWatchHistory();
  if (current.length === 0) return;

  clearedWatchHistoryBackup = [...current];
  localStorage.removeItem(WATCH_HISTORY_KEY);
  renderContinueWatchingSection();

  showToastWithUndo(
    'Watch History cleared',
    'fa-trash-can',
    () => {
      undoClearWatchHistory();
    },
    5000
  );
};

window.undoClearWatchHistory = function() {
  if (!clearedWatchHistoryBackup || clearedWatchHistoryBackup.length === 0) return;
  try {
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(clearedWatchHistoryBackup));
    renderContinueWatchingSection();
    showToast(`Restored ${clearedWatchHistoryBackup.length} episodes to Watch History`, 'fa-rotate-left');
    clearedWatchHistoryBackup = null;
  } catch (e) {
    console.error('Undo clear error:', e);
  }
};

function updateNavHistoryIndicator() {
  const navItem = document.getElementById('navHistoryItem');
  if (navItem) {
    const history = getWatchHistory();
    navItem.style.display = history.length > 0 ? 'inline-block' : 'none';
  }
}

function renderContinueWatchingSection() {
  const section = document.getElementById('history-section');
  const container = document.getElementById('historyCardsContainer');
  updateNavHistoryIndicator();
  if (!section || !container) return;

  const history = getWatchHistory();
  if (history.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  container.innerHTML = history.map(item => {
    // Clean, short & shareable URL: watch.html?v=SLUG
    const watchLink = `watch.html?v=${encodeURIComponent(item.slug || item.id)}`;
    const resumeLabel = item.currentTime > 0 ? `Resume (${formatTime(item.currentTime)})` : 'Resume Episode';

    return `
    <div class="episode-card continue-card">
      <button class="history-remove-btn" onclick="removeFromWatchHistory('${item.id}', event)" title="Remove from history">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <a href="${watchLink}" style="text-decoration:none; color:inherit; display:flex; flex-direction:column; height:100%;">
        <div class="card-thumb-wrapper">
          <img src="${item.thumbnail}" alt="${item.title}" class="card-thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='/api/image'">
          <div class="card-watch-progress">
            <div class="card-watch-progress-fill" style="width: ${item.progress}%;"></div>
          </div>
          <span class="resume-pill"><i class="fa-solid fa-clock-rotate-left"></i> ${item.progress}%</span>
          <div class="play-hover-btn"><i class="fa-solid fa-play"></i></div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${item.title}</h3>
          <div class="card-meta">
            <span style="color:#00d26a; font-weight:700;"><i class="fa-solid fa-circle-play"></i> ${resumeLabel}</span>
            <span>${item.duration > 0 ? formatTime(item.duration) : 'HD'}</span>
          </div>
        </div>
      </a>
    </div>`;
  }).join('');
}

// ==================================================================
// 1. HOME PAGE
// ==================================================================
let allHomepageEpisodes = [];
let currentHomePage = 1;
let isLoadingMoreHome = false;

async function loadHomePage() {
  const container = document.getElementById('episodesContainer');
  const showsContainer = document.getElementById('popularShowsContainer');
  
  // Render Continue Watching Shelf if items exist
  renderContinueWatchingSection();

  showLoader(container, 'Connecting to Cloudflare Secure Stream Network...');

  currentHomePage = 1;
  const res = await apiGet('/episodes?page=1');
  if (res && res.data && res.data.length > 0) {
    allHomepageEpisodes = res.data;
    renderHomeContent(container);

    // Show 'Show More' button if there are episodes
    const moreWrap = document.getElementById('homeLoadMoreWrap');
    if (moreWrap) {
      moreWrap.style.display = res.data.length >= 6 ? 'block' : 'none';
    }

    // Update hero banner button with latest episode
    const heroBtn = document.getElementById('heroPlayBtn');
    if (heroBtn && res.data[0]) {
      const firstSlug = res.data[0].id || res.data[0].slug;
      let pathToken = '';
      if (res.data[0].url) {
        const cleanRel = res.data[0].url.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
        try { pathToken = btoa(cleanRel); } catch(e) {}
      }
      heroBtn.href = pathToken ? `watch.html?v=${encodeURIComponent(firstSlug)}&t=${encodeURIComponent(pathToken)}` : `watch.html?v=${encodeURIComponent(firstSlug)}`;
    }
  } else {
    showError(container, 'Could not load episodes. Cloudflare connection in progress, please refresh.');
  }

  // Also load shows for Popular Serials Section
  if (showsContainer) {
    const showsRes = await apiGet('/shows?channel=vijay-tv-programs');
    if (showsRes && showsRes.data && showsRes.data.length > 0) {
      showsContainer.innerHTML = showsRes.data.map(sh => `
        <a href="show.html?show=${encodeURIComponent(sh.slug)}&path=${encodeURIComponent(sh.path || sh.slug)}" class="episode-card">
          <div class="card-thumb-wrapper">
            <img src="${sh.thumbnail || '/api/image'}" alt="${sh.title}" class="card-thumb" referrerpolicy="no-referrer" onerror="this.src='/api/image'">
            <div class="play-hover-btn"><i class="fa-solid fa-list"></i></div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${sh.title}</h3>
            <div class="card-meta">
              <span>Serial Archive</span>
              <span>All Episodes</span>
            </div>
          </div>
        </a>
      `).join('');
    }
  }
}

let currentHomeView = 'episodes'; // 'episodes' (default) or 'serials'

// Switch Homepage View Mode: 'serials' or 'episodes'
window.switchHomeView = function(mode) {
  currentHomeView = mode;
  const serialsBtn = document.getElementById('viewSerialsBtn');
  const episodesBtn = document.getElementById('viewEpisodesBtn');
  const heading = document.getElementById('homeSectionHeading');
  const subtitle = document.getElementById('homeSectionSub');
  const container = document.getElementById('episodesContainer');

  if (serialsBtn) {
    if (mode === 'serials') serialsBtn.classList.add('active');
    else serialsBtn.classList.remove('active');
  }
  if (episodesBtn) {
    if (mode === 'episodes') episodesBtn.classList.add('active');
    else episodesBtn.classList.remove('active');
  }

  if (mode === 'serials') {
    if (heading) heading.innerText = 'Latest Serials & Shows';
    if (subtitle) subtitle.innerText = 'Click any Serial to open all episodes archive';
    renderHomeContent(container);
  } else {
    if (heading) heading.innerText = 'Latest Episodes';
    if (subtitle) subtitle.innerText = 'Direct stream individual latest episodes';
    renderHomeContent(container);
  }
};

// Render Serial Card pointing to show.html
function buildSerialCardHtml(serial) {
  const thumb = serial.thumbnail || '/api/image';
  const showSlug = serial.showSlug || serial.slug;
  const showPath = serial.showPath || '';
  let showLink = `show.html?show=${encodeURIComponent(showSlug)}`;
  if (showPath) showLink += `&path=${encodeURIComponent(showPath)}`;

  return `
  <a href="${showLink}" class="episode-card serial-card">
    <div class="card-thumb-wrapper">
      <img src="${thumb}" alt="${serial.showTitle}" class="card-thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='/api/image'">
      <span class="card-tag" style="background: #e50914;"><i class="fa-solid fa-folder-open"></i> Full Serial</span>
      ${serial.channelName ? `<span class="card-channel-badge">${serial.channelName}</span>` : ''}
      <span class="card-duration"><i class="fa-solid fa-list-check"></i> All Episodes</span>
      <div class="play-hover-btn"><i class="fa-solid fa-arrow-right"></i></div>
    </div>
    <div class="card-content">
      <h3 class="card-title">${serial.showTitle}</h3>
      <div class="card-meta">
        <span style="color:var(--primary); font-weight:600;"><i class="fa-solid fa-clock"></i> Latest: ${serial.dateFormatted || 'Today'}</span>
        <span>View Archive &rarr;</span>
      </div>
    </div>
  </a>`;
}

// Group homepage episodes by unique Serial/Show
function getGroupedSerials(episodesList) {
  const serialMap = new Map();
  episodesList.forEach(ep => {
    const sSlug = ep.showSlug || extractShowSlug(ep.slug || ep.id, ep.url);
    if (!sSlug) return;
    if (!serialMap.has(sSlug)) {
      serialMap.set(sSlug, {
        showSlug: sSlug,
        showPath: ep.showPath || '',
        showTitle: ep.showTitle || sSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        channelName: ep.channelName || '',
        thumbnail: ep.thumbnail,
        dateFormatted: ep.dateFormatted || ep.date,
        latestEpSlug: ep.id || ep.slug,
        latestEpTitle: ep.title
      });
    }
  });
  return Array.from(serialMap.values());
}

function renderHomeContent(container) {
  if (!container || !allHomepageEpisodes) return;
  if (currentHomeView === 'serials') {
    const serials = getGroupedSerials(allHomepageEpisodes);
    if (serials.length === 0) {
      renderEpisodeCards(allHomepageEpisodes, container);
    } else {
      container.innerHTML = serials.map(buildSerialCardHtml).join('');
    }
  } else {
    renderEpisodeCards(allHomepageEpisodes, container);
  }
}

// Load Next Page of Homepage Episodes
async function loadMoreHomeEpisodes() {
  if (isLoadingMoreHome) return;
  const btn = document.getElementById('homeLoadMoreBtn');
  const container = document.getElementById('episodesContainer');
  if (!btn || !container) return;

  isLoadingMoreHome = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Securing Next Episodes (Cloudflare CDN)...`;
  btn.disabled = true;

  currentHomePage += 1;
  const res = await apiGet(`/episodes?page=${currentHomePage}`);
  if (res && res.data && res.data.length > 0) {
    allHomepageEpisodes = allHomepageEpisodes.concat(res.data);
    if (currentHomeView === 'serials') {
      renderHomeContent(container);
    } else {
      appendEpisodeCards(res.data, container);
    }
    btn.innerHTML = `<i class="fa-solid fa-angles-down"></i> Show More Episodes`;
    btn.disabled = false;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-check"></i> All Episodes Loaded`;
    btn.disabled = true;
    setTimeout(() => {
      const moreWrap = document.getElementById('homeLoadMoreWrap');
      if (moreWrap) moreWrap.style.display = 'none';
    }, 2500);
  }
  isLoadingMoreHome = false;
}

function filterByChannel(channel, btnEl) {
  if (btnEl) {
    document.querySelectorAll('.channel-pill').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }
  const container = document.getElementById('episodesContainer');
  if (!container || !allHomepageEpisodes) return;

  if (channel === 'all') {
    renderHomeContent(container);
  } else if (channel === 'bigg-boss') {
    const filtered = allHomepageEpisodes.filter(ep => {
      const url = (ep.url || '').toLowerCase();
      const title = (ep.title || '').toLowerCase();
      return url.includes('bigg-boss') || title.includes('bigg boss');
    });
    if (filtered.length > 0) {
      renderEpisodeCards(filtered, container);
    } else {
      showLoader(container, 'Securing Bigg Boss Tamil episodes...');
      apiGet('/episodes?show=bigg-boss-tamil-season-10&path=vijay-tv/vijay-tv-show/bigg-boss-tamil-season-10').then(res => {
        if (res && res.data && res.data.length > 0) {
          renderEpisodeCards(res.data, container);
        } else {
          showError(container, 'No Bigg Boss episodes found.');
        }
      });
    }
  } else if (channel === 'reality-shows') {
    showLoader(container, 'Securing Reality Shows (Cooku With Comali, Super Singer, Neeya Naana, etc.)...');
    apiGet('/shows?channel=reality-shows').then(res => {
      if (res && res.data && res.data.length > 0) {
        container.innerHTML = res.data.map(show => `
          <a href="show.html?show=${encodeURIComponent(show.slug)}&path=${encodeURIComponent(show.path)}" class="episode-card">
            <div class="card-thumb-wrapper">
              <img src="${show.thumbnail || '/api/image'}" alt="${show.title}" class="card-thumb" loading="lazy" onerror="this.src='/api/image'">
              <span class="card-tag" style="background:#f6821f;"><i class="fa-solid fa-trophy"></i> Reality Show</span>
              <div class="play-hover-btn"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="card-content">
              <h3 class="card-title">${show.title}</h3>
              <div class="card-meta">
                <span>All Episodes Archive</span>
              </div>
            </div>
          </a>
        `).join('');
      } else {
        showError(container, 'No reality shows found.');
      }
    });
  } else {
    const filtered = allHomepageEpisodes.filter(ep => {
      const chName = (ep.channelName || '').toLowerCase().replace(/\s+/g, '-');
      const url = (ep.url || '').toLowerCase();
      const title = (ep.title || '').toLowerCase();
      return chName.includes(channel) || url.includes(channel) || title.includes(channel);
    });
    renderEpisodeCards(filtered, container);
  }
}

// Generate single card HTML with OTT features
function buildEpisodeCardHtml(ep, isCur = false) {
  const thumb = ep.thumbnail || '/api/image';
  const epSlug = ep.id || ep.slug;
  // Clean, short & shareable URL: watch.html?v=SLUG
  const watchLink = `watch.html?v=${encodeURIComponent(epSlug)}`;
  const durationLabel = (ep.duration && ep.duration !== '22 Mins') ? ep.duration : 'Full Episode';

  // Check Watch History for progress
  const history = getWatchHistory();
  const histItem = history.find(h => (h.id === epSlug || h.slug === epSlug));
  const progressPercent = histItem ? histItem.progress : 0;

  return `
  <a href="${watchLink}" class="episode-card ${isCur ? 'is-playing' : ''}">
    <div class="card-thumb-wrapper">
      <img src="${thumb}" alt="${ep.title}" class="card-thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='/api/image'">
      ${isCur ? `<span class="now-playing-badge"><i class="fa-solid fa-volume-high fa-fade"></i> NOW PLAYING</span>` : (ep.tag ? `<span class="card-tag">${ep.tag}</span>` : '')}
      ${ep.channelName ? `<span class="card-channel-badge">${ep.channelName}</span>` : ''}
      <span class="card-duration"><i class="fa-solid fa-circle-play"></i> ${durationLabel}</span>
      ${progressPercent > 0 ? `
        <div class="card-watch-progress">
          <div class="card-watch-progress-fill" style="width: ${progressPercent}%;"></div>
        </div>
      ` : ''}
      <div class="play-hover-btn"><i class="fa-solid fa-play"></i></div>
    </div>
    <div class="card-content">
      <h3 class="card-title">${ep.title}</h3>
      <div class="card-meta">
        <span>${ep.dateFormatted || ep.date || 'Latest'}</span>
        <span>${ep.showTitle || 'HD Quality'}</span>
      </div>
    </div>
  </a>`;
}

function renderEpisodeCards(list, container) {
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">No episodes found.</div>`;
    return;
  }
  container.innerHTML = list.map(buildEpisodeCardHtml).join('');
}

function appendEpisodeCards(list, container) {
  if (!container || !list || list.length === 0) return;
  const html = list.map(buildEpisodeCardHtml).join('');
  container.insertAdjacentHTML('beforeend', html);
}

// ==================================================================
// 2. WATCH / PLAYER PAGE
// ==================================================================
let currentEpisode = null;
let currentSerialEpisodes = [];
let currentEpisodeIndex = -1;
let autoPlayCountdownTimer = null;
let plyrInstance = null;

function showToast(message, icon = 'fa-circle-check') {
  const existing = document.querySelector('.streamx-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'streamx-toast';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

function showToastWithUndo(message, icon = 'fa-circle-check', onUndo, durationMs = 5000) {
  const existing = document.querySelector('.streamx-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'streamx-toast streamx-toast-undo';
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <i class="fa-solid ${icon}"></i>
      <span style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${message}</span>
    </div>
    <button class="toast-undo-btn" id="toastUndoBtn">
      <i class="fa-solid fa-rotate-left"></i> Undo
    </button>
    <div class="toast-progress-bar" style="animation-duration: ${durationMs}ms;"></div>
  `;
  document.body.appendChild(toast);

  const undoBtn = toast.querySelector('#toastUndoBtn');
  let isUndone = false;
  if (undoBtn) {
    undoBtn.onclick = (e) => {
      e.stopPropagation();
      isUndone = true;
      toast.remove();
      if (typeof onUndo === 'function') onUndo();
    };
  }

  setTimeout(() => {
    if (!isUndone && document.body.contains(toast)) {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }
  }, durationMs);
}

async function initWatchPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('v') || params.get('slug') || params.get('id');
  const token = params.get('t');
  let epUrl = params.get('url');

  if (!slug && !epUrl && !token) {
    window.location.href = 'index.html';
    return;
  }

  // If token is provided, decode relative path cleanly
  if (token && !epUrl) {
    try {
      const decodedRel = atob(token);
      epUrl = `https://www.tamildhool.tech/${decodedRel.replace(/^\/|\/$/g, '')}/`;
    } catch(e) {}
  }

  const videoFrame = document.getElementById('videoPlayerFrame');
  let loadSeconds = 0;
  let loadTimerInterval = null;

  if (videoFrame) {
    videoFrame.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:14px;padding:20px;text-align:center;">
        <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(229,9,20,0.12);border:2px solid rgba(229,9,20,0.35);box-shadow:0 0 25px rgba(229,9,20,0.25);">
          <i class="fa-solid fa-play fa-fade" style="color:var(--primary);font-size:1.6rem;margin-left:4px;"></i>
        </div>
        <div>
          <p style="font-size:1rem;font-weight:700;color:var(--text-main);margin-bottom:4px;" id="streamLoadingTitle">Connecting Ultra HD Stream...</p>
          <p style="font-size:0.8rem;color:var(--text-muted);" id="streamLoadingSubtitle">Securing high-speed CDN playback</p>
        </div>
        <div style="display:inline-flex;align-items:center;gap:8px;padding:4px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;font-size:0.75rem;color:#cbd5e1;">
          <i class="fa-solid fa-stopwatch" style="color:#00d26a;"></i>
          <span>Elapsed: <strong id="streamLoadTimer" style="color:#00d26a;">0.0s</strong></span>
        </div>
      </div>
    `;

    const timerStart = Date.now();
    loadTimerInterval = setInterval(() => {
      const elapsed = ((Date.now() - timerStart) / 1000).toFixed(1);
      const timerEl = document.getElementById('streamLoadTimer');
      const subEl = document.getElementById('streamLoadingSubtitle');
      if (timerEl) timerEl.innerText = `${elapsed}s`;
      if (subEl) {
        if (elapsed > 4 && elapsed <= 8) {
          subEl.innerText = 'Bypassing Cloudflare & retrieving master playlist...';
        } else if (elapsed > 8) {
          subEl.innerText = 'Finalizing multi-resolution HD stream mirrors...';
        }
      }
    }, 100);
  }

  // Build clean API URL
  let apiUrl = `/episode?slug=${encodeURIComponent(slug || '')}`;
  if (epUrl) apiUrl += `&url=${encodeURIComponent(epUrl)}`;

  const res = await apiGet(apiUrl);
  if (loadTimerInterval) clearInterval(loadTimerInterval);

  if (!res || !res.data) {
    if (videoFrame) {
      videoFrame.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#e55;gap:12px;">
        <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
        <p>Failed to connect video stream. <a href="javascript:location.reload()" style="color:#e50914;">Retry</a></p>
      </div>`;
    }
    return;
  }

  currentEpisode = res.data;
  renderPlayer(currentEpisode);
}

function renderPlayer(ep) {
  const brandName = window.APP_CONFIG ? window.APP_CONFIG.shortName : 'StreamX';
  document.title = `${ep.title || 'Episode'} - ${brandName}`;

  // Breadcrumbs
  const bc = document.getElementById('playerBreadcrumbs');
  if (bc) {
    bc.innerHTML = `
      <a href="index.html"><i class="fa-solid fa-house"></i> Home</a>
      <span>/</span>
      <span style="color:var(--text-main);">${ep.title || 'Episode'}</span>`;
  }

  // Episode Info
  const titleEl = document.getElementById('epTitle');
  const descEl = document.getElementById('epDesc');
  const dateEl = document.getElementById('epDate');
  if (titleEl) titleEl.innerText = ep.title || '';
  if (descEl) descEl.innerText = ep.description || '';
  if (dateEl) dateEl.innerText = '';

  // Thumbnail as poster
  const thumbEl = document.getElementById('epThumbnail');
  if (thumbEl && ep.thumbnail) thumbEl.src = ep.thumbnail;

  // Servers
  const serverList = document.getElementById('serverList');
  if (serverList && ep.servers && ep.servers.length > 0) {
    serverList.innerHTML = ep.servers.map((srv, idx) => `
      <button class="server-btn ${idx === 0 ? 'active' : ''}" onclick="switchServer(${idx}, this)">
        <i class="fa-solid fa-server"></i> ${srv.name}
        ${srv.badge ? `<span style="background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:4px;font-size:0.7rem;">${srv.badge}</span>` : ''}
      </button>
    `).join('');

    switchServer(0);

    // Setup Direct Download button (Full MP4 video)
    const dlBtn = document.getElementById('downloadStreamBtn');
    if (ep.videoId && dlBtn) {
      const cleanFileTitle = (ep.title || 'Tamil-Serial').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
      dlBtn.href = `/api/download?v=${encodeURIComponent(ep.videoId)}&title=${encodeURIComponent(cleanFileTitle)}`;
      dlBtn.setAttribute('download', `${cleanFileTitle}.mp4`);
      dlBtn.style.display = 'inline-flex';
      dlBtn.title = 'Click to download complete episode video (.mp4)';
    }
  } else {
    const videoFrame = document.getElementById('videoPlayerFrame');
    if (videoFrame) {
      videoFrame.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">
        <p>No video streams available for this episode yet.</p>
      </div>`;
    }
  }

  // Load Related Serial Episodes & Setup Next/Prev Navigation
  loadSerialShelfAndNav(ep);
}

// Extract base serial slug from episode slug or URL
function extractShowSlug(slug, epUrl) {
  if (epUrl) {
    const cleanUrl = epUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
    const parts = cleanUrl.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (candidate && !candidate.endsWith('-programs') && !candidate.endsWith('-serial') && !candidate.endsWith('-show')) {
        return candidate;
      }
    }
  }
  if (!slug) return '';
  return slug
    .replace(/-(sun|vijay|zee-tamil|colors-tamil)-(tv|serial|show).*$/i, '')
    .replace(/-\d{2}-\d{2}-\d{4}.*$/, '')
    .replace(/-day-\d+.*$/i, '')
    .replace(/-serial.*$/i, '')
    .replace(/-show.*$/i, '')
    .replace(/-episode.*$/i, '');
}

// Global Quality Switcher
window.changeStreamQuality = function(val) {
  if (!window._currentHls) {
    showToast(val === 'auto' ? 'Quality set to Auto (HD)' : `Quality set to ${val}p`, 'fa-sliders');
    return;
  }

  const hls = window._currentHls;
  if (val === 'auto') {
    hls.currentLevel = -1; // Auto
    showToast('Quality set to Auto (Adaptive HD)', 'fa-sliders');
  } else {
    const targetHeight = parseInt(val, 10);
    if (hls.levels && hls.levels.length > 0) {
      let closestIdx = 0;
      let minDiff = 99999;
      hls.levels.forEach((lvl, idx) => {
        const diff = Math.abs((lvl.height || 0) - targetHeight);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      hls.currentLevel = closestIdx;
      const actualHeight = hls.levels[closestIdx].height || targetHeight;
      showToast(`Stream quality set to ${actualHeight}p`, 'fa-sliders');
    } else {
      showToast(`Stream quality set to ${val}p`, 'fa-sliders');
    }
  }
};

let shelfSortAsc = false; // false = newest first, true = oldest first

function renderSerialShelf() {
  const container = document.getElementById('relatedEpisodesContainer');
  const countEl = document.getElementById('shelfEpisodeCount');
  if (!container || !currentSerialEpisodes) return;

  if (countEl) {
    countEl.innerText = `${currentSerialEpisodes.length} Episodes`;
  }

  const listToRender = [...currentSerialEpisodes];
  if (shelfSortAsc) {
    listToRender.reverse();
  }

  const currentSlug = currentEpisode ? (currentEpisode.id || currentEpisode.slug) : '';
  container.innerHTML = listToRender.map(item => {
    const isCur = currentSlug && ((item.id === currentSlug) || (item.slug === currentSlug) ||
      (currentEpisode && currentEpisode.title && item.title && item.title.trim().toLowerCase() === currentEpisode.title.trim().toLowerCase()));
    return buildEpisodeCardHtml(item, isCur);
  }).join('');
}

window.toggleShelfSort = async function() {
  shelfSortAsc = !shelfSortAsc;
  const sortText = document.getElementById('sortBtnText');
  if (sortText) {
    sortText.innerText = shelfSortAsc ? 'Oldest First' : 'Newest First';
  }

  // If user selected Oldest First, fetch additional previous pages so older episodes appear
  if (shelfSortAsc && currentShelfShowSlug && currentShelfPage === 1) {
    showToast('Fetching earlier episodes from serial archive...', 'fa-spinner fa-spin');
    try {
      let page2Url = `/episodes?show=${encodeURIComponent(currentShelfShowSlug)}&page=2`;
      if (currentShelfShowPath) page2Url += `&path=${encodeURIComponent(currentShelfShowPath)}`;
      const res2 = await apiGet(page2Url);
      if (res2 && res2.data && res2.data.length > 0) {
        currentShelfPage = 2;
        res2.data.forEach(item => {
          const exists = currentSerialEpisodes.find(e => (e.id === item.id) || (e.slug === item.slug));
          if (!exists) currentSerialEpisodes.push(item);
        });
      }
    } catch(e) {}
  }

  renderSerialShelf();
  updateFsEpisodesDrawer();
  showToast(shelfSortAsc ? 'Sorted by Oldest First' : 'Sorted by Newest First', 'fa-arrow-down-short-wide');
};

let currentShelfPage = 1;
let currentShelfShowSlug = '';
let currentShelfShowPath = '';
let isLoadingMoreShelf = false;

async function loadSerialShelfAndNav(ep) {
  const currentSlug = ep.id || ep.slug || '';
  const showSlug = ep.showSlug || extractShowSlug(currentSlug, ep.url);
  const showPath = ep.showPath || '';
  const navContainer = document.getElementById('epNavButtons');

  currentShelfShowSlug = showSlug;
  currentShelfShowPath = showPath;
  currentShelfPage = 2; // Initial batch already includes page 1 & 2

  let episodesList = [];

  if (showSlug) {
    let p1Url = `/episodes?show=${encodeURIComponent(showSlug)}&page=1`;
    let p2Url = `/episodes?show=${encodeURIComponent(showSlug)}&page=2`;
    if (showPath) {
      p1Url += `&path=${encodeURIComponent(showPath)}`;
      p2Url += `&path=${encodeURIComponent(showPath)}`;
    }

    // Fetch page 1 immediately for instant shelf rendering, then merge page 2
    try {
      const res1 = await apiGet(p1Url);
      if (res1 && res1.data && res1.data.length > 0) {
        episodesList = [...res1.data];
      }

      // Parallel/background fetch page 2 for deeper catalog
      apiGet(p2Url).then(res2 => {
        if (res2 && res2.data && res2.data.length > 0) {
          res2.data.forEach(item => {
            const exists = currentSerialEpisodes.find(e => (e.id === item.id) || (e.slug === item.slug));
            if (!exists) currentSerialEpisodes.push(item);
          });
          renderSerialShelf();
          updateFsEpisodesDrawer();
        }
      }).catch(() => {});
    } catch (e) {}
  }

  // Fallback: If show archive returned empty, fetch latest episodes from homepage
  if (episodesList.length === 0) {
    const homeRes = await apiGet('/episodes?page=1');
    if (homeRes && homeRes.data && homeRes.data.length > 0) {
      const filtered = homeRes.data.filter(item => {
        const itemSlug = item.id || item.slug || '';
        const baseSlug = extractShowSlug(itemSlug, item.url);
        return (showSlug && baseSlug && baseSlug.includes(showSlug)) ||
               (ep.title && item.title && item.title.toLowerCase().includes(ep.title.split('|')[0].trim().toLowerCase()));
      });
      episodesList = filtered.length > 0 ? filtered : homeRes.data.slice(0, 10);
    }
  }

  currentSerialEpisodes = episodesList;

  // Find index of current playing episode
  currentEpisodeIndex = currentSerialEpisodes.findIndex(item => {
    return (item.id && currentSlug && (item.id === currentSlug || item.id.includes(currentSlug))) ||
           (item.slug && currentSlug && (item.slug === currentSlug || item.slug.includes(currentSlug))) ||
           (item.title && ep.title && item.title.trim().toLowerCase() === ep.title.trim().toLowerCase());
  });

  // If current episode wasn't found in list, insert it at index 0
  if (currentEpisodeIndex === -1 && currentEpisode) {
    currentSerialEpisodes.unshift(currentEpisode);
    currentEpisodeIndex = 0;
  }

  // Update shelf pagination controls & archive link
  const shelfMoreWrap = document.getElementById('shelfMoreWrap');
  const viewArchiveBtn = document.getElementById('shelfViewArchiveBtn');
  if (shelfMoreWrap) {
    shelfMoreWrap.style.display = currentSerialEpisodes.length >= 6 ? 'block' : 'none';
  }
  if (viewArchiveBtn && showSlug) {
    let archLink = `show.html?show=${encodeURIComponent(showSlug)}`;
    if (showPath) archLink += `&path=${encodeURIComponent(showPath)}`;
    viewArchiveBtn.href = archLink;
  }

  // Render Prev / Next Bar
  renderNextPrevNavigation(navContainer);

  // Render OTT Episodes Shelf
  renderSerialShelf();

  // Populate In-Player / Fullscreen Episodes Drawer
  updateFsEpisodesDrawer();
}

// Fetch Next Page of Episodes for Watch Page Shelf
window.loadMoreShelfEpisodes = async function() {
  if (isLoadingMoreShelf || !currentShelfShowSlug) return;
  const btn = document.getElementById('shelfLoadMoreBtn');
  if (!btn) return;

  isLoadingMoreShelf = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading More Episodes...`;
  btn.disabled = true;

  currentShelfPage += 1;
  let apiUrl = `/episodes?show=${encodeURIComponent(currentShelfShowSlug)}&page=${currentShelfPage}`;
  if (currentShelfShowPath) apiUrl += `&path=${encodeURIComponent(currentShelfShowPath)}`;

  const res = await apiGet(apiUrl);
  if (res && res.data && res.data.length > 0) {
    // Append unique episodes
    res.data.forEach(item => {
      const exists = currentSerialEpisodes.find(e => (e.id === item.id) || (e.slug === item.slug));
      if (!exists) {
        currentSerialEpisodes.push(item);
      }
    });

    renderSerialShelf();
    updateFsEpisodesDrawer();
    btn.innerHTML = `<i class="fa-solid fa-angles-down"></i> Load More Older Episodes`;
    btn.disabled = false;
    showToast(`Loaded ${res.data.length} more episodes`, 'fa-layer-group');
  } else {
    btn.innerHTML = `<i class="fa-solid fa-check"></i> All Archived Episodes Loaded`;
    btn.disabled = true;
    showToast('All episodes loaded for this serial', 'fa-check');
  }
  isLoadingMoreShelf = false;
};

// ==================================================================
// FULLSCREEN IN-PLAYER OTT "MORE EPISODES" DRAWER & SWIPE GESTURE
// ==================================================================
function initFsEpisodesDrawer(playerHost) {
  if (!playerHost) return;
  // If drawer already exists in host, don't re-create
  if (playerHost.querySelector('#fsEpisodeDrawer')) {
    updateFsEpisodesDrawer();
    return;
  }

  // Floating Pill in Player Controls/Corner
  const pill = document.createElement('button');
  pill.id = 'fsEpisodesPill';
  pill.className = 'fs-episodes-pill';
  pill.innerHTML = `<i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> <span>More Episodes</span>`;
  pill.title = 'Browse more serial episodes (Swipe Up / Press E)';
  pill.onclick = (e) => {
    e.stopPropagation();
    toggleFsEpisodesDrawer();
  };

  // Drawer Backdrop (Clicking outside closes drawer on PC/Mobile)
  const backdrop = document.createElement('div');
  backdrop.id = 'fsDrawerBackdrop';
  backdrop.className = 'fs-drawer-backdrop';
  backdrop.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    window.closeFsEpisodesDrawer();
  };

  // Drawer Bottom Sheet
  const drawer = document.createElement('div');
  drawer.id = 'fsEpisodeDrawer';
  drawer.className = 'fs-episodes-drawer';
  drawer.innerHTML = `
    <div class="fs-drawer-drag-handle" id="fsDrawerDragHandle" onclick="closeFsEpisodesDrawer(event)" title="Drag down or click to close"></div>
    <div class="fs-drawer-header">
      <div class="fs-drawer-title">
        <i class="fa-solid fa-list-ul" style="color:var(--primary);"></i>
        <span>More Episodes</span>
        <span id="fsDrawerCount" style="font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.1);color:var(--text-muted);"></span>
      </div>
      <button type="button" class="fs-drawer-close-btn" id="fsDrawerCloseBtn" onclick="closeFsEpisodesDrawer(event)" title="Close Episodes Drawer (Esc)">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="fs-drawer-carousel" id="fsDrawerCarousel"></div>
  `;

  playerHost.appendChild(pill);
  playerHost.appendChild(backdrop);
  playerHost.appendChild(drawer);

  // Directly attach click handler to close button to guarantee closing
  const closeBtn = drawer.querySelector('#fsDrawerCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      window.closeFsEpisodesDrawer(ev);
    });
  }

  // Setup Mobile Touch Swipe Gestures
  attachDrawerSwipeGestures(playerHost, drawer);

  // Initial population
  updateFsEpisodesDrawer();
}

function updateFsEpisodesDrawer() {
  const carousel = document.getElementById('fsDrawerCarousel');
  const countEl = document.getElementById('fsDrawerCount');
  if (!carousel || !currentSerialEpisodes || currentSerialEpisodes.length === 0) return;

  if (countEl) {
    countEl.innerText = `${currentSerialEpisodes.length} Episodes`;
  }

  const currentSlug = currentEpisode ? (currentEpisode.id || currentEpisode.slug) : '';

  carousel.innerHTML = currentSerialEpisodes.map(ep => {
    const isCur = currentSlug && ((ep.id === currentSlug) || (ep.slug === currentSlug) ||
      (currentEpisode && currentEpisode.title && ep.title && ep.title.trim().toLowerCase() === currentEpisode.title.trim().toLowerCase()));

    const thumb = ep.thumbnail || '/api/image';
    const epSlug = ep.id || ep.slug;
    const watchLink = `watch.html?v=${encodeURIComponent(epSlug)}`;
    const durationLabel = (ep.duration && ep.duration !== '22 Mins') ? ep.duration : 'Full Ep';

    return `
      <a href="${watchLink}" class="fs-ep-card ${isCur ? 'is-playing' : ''}">
        <div class="card-thumb-wrapper">
          <img src="${thumb}" alt="${ep.title}" class="card-thumb" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='/api/image'">
          ${isCur ? `<span class="now-playing-badge" style="font-size:0.6rem;padding:3px 6px;"><i class="fa-solid fa-volume-high"></i> PLAYING</span>` : ''}
          <span class="card-duration" style="font-size:0.65rem;padding:2px 6px;">${durationLabel}</span>
          <div class="play-hover-btn" style="width:36px;height:36px;font-size:0.9rem;"><i class="fa-solid fa-play"></i></div>
        </div>
        <div class="card-content">
          <div class="card-title">${ep.title}</div>
          <div class="card-meta">
            <span>${ep.dateFormatted || ep.date || 'Latest'}</span>
            <span>${ep.showTitle || 'HD'}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');

  // Only scroll carousel horizontally if the drawer is currently open (NEVER use scrollIntoView as it scrolls parent overflow:hidden containers!)
  const drawer = document.getElementById('fsEpisodeDrawer');
  if (drawer && drawer.classList.contains('is-open')) {
    centerActiveDrawerCard();
  }
}

function centerActiveDrawerCard() {
  const carousel = document.getElementById('fsDrawerCarousel');
  if (!carousel) return;
  const activeCard = carousel.querySelector('.fs-ep-card.is-playing');
  if (activeCard) {
    const targetLeft = activeCard.offsetLeft - (carousel.clientWidth / 2) + (activeCard.clientWidth / 2);
    carousel.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }
}

window.toggleFsEpisodesDrawer = function(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const drawer = document.getElementById('fsEpisodeDrawer');
  if (!drawer) return;
  if (drawer.classList.contains('is-open')) {
    window.closeFsEpisodesDrawer();
  } else {
    window.openFsEpisodesDrawer();
  }
};

window.openFsEpisodesDrawer = function(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const drawer = document.getElementById('fsEpisodeDrawer');
  const backdrop = document.getElementById('fsDrawerBackdrop');
  if (!drawer) return;
  drawer.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-visible');

  // Scroll carousel horizontally to active playing episode without affecting vertical scroll
  setTimeout(centerActiveDrawerCard, 50);
};

window.closeFsEpisodesDrawer = function(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const drawer = document.getElementById('fsEpisodeDrawer');
  const backdrop = document.getElementById('fsDrawerBackdrop');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-visible');
};

// Touch swipe gesture listeners
function attachDrawerSwipeGestures(host, drawer) {
  let touchStartY = 0;
  let touchStartX = 0;

  // Swipe UP on player host opens drawer
  host.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  host.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      const endY = e.changedTouches[0].clientY;
      const endX = e.changedTouches[0].clientX;
      const deltaY = touchStartY - endY;
      const deltaX = Math.abs(touchStartX - endX);

      // Upwards swipe > 45px and predominantly vertical
      if (deltaY > 45 && deltaX < 80) {
        openFsEpisodesDrawer();
      }
    }
  }, { passive: true });

  // Swipe DOWN on drawer closes drawer
  drawer.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  drawer.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      const endY = e.changedTouches[0].clientY;
      const endX = e.changedTouches[0].clientX;
      const deltaY = endY - touchStartY;
      const deltaX = Math.abs(touchStartX - endX);

      // Downwards swipe > 45px and predominantly vertical
      if (deltaY > 45 && deltaX < 80) {
        closeFsEpisodesDrawer();
      }
    }
  }, { passive: true });
}

function renderNextPrevNavigation(navContainer) {
  if (!navContainer) return;

  // Reverse chronological: index - 1 is newer (Next Episode), index + 1 is older (Previous Episode)
  const nextEp = (currentEpisodeIndex > 0) ? currentSerialEpisodes[currentEpisodeIndex - 1] : null;
  const prevEp = (currentEpisodeIndex >= 0 && currentEpisodeIndex < currentSerialEpisodes.length - 1)
    ? currentSerialEpisodes[currentEpisodeIndex + 1] : null;

  function buildNavBtn(targetEp, label, icon) {
    if (!targetEp) {
      return `<button class="ep-nav-btn disabled" disabled><i class="fa-solid ${icon}"></i> ${label}</button>`;
    }
    const epSlug = targetEp.id || targetEp.slug;
    const watchLink = `watch.html?v=${encodeURIComponent(epSlug)}`;
    return `<a href="${watchLink}" class="ep-nav-btn"><i class="fa-solid ${icon}"></i> ${label}</a>`;
  }

  const prevBtnHtml = buildNavBtn(prevEp, 'Previous Episode', 'fa-backward-step');
  const nextBtnHtml = buildNavBtn(nextEp, 'Next Episode', 'fa-forward-step');

  const autoPlayChecked = localStorage.getItem('streamx_autoplay_next') !== 'false';

  navContainer.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;">
      ${prevBtnHtml}
      ${nextBtnHtml}
    </div>
    <label class="autoplay-toggle">
      <input type="checkbox" id="autoPlayNextCheck" ${autoPlayChecked ? 'checked' : ''} onchange="toggleAutoPlayNext(this.checked)">
      <span><i class="fa-solid fa-play"></i> Auto-Play Next Episode</span>
    </label>
  `;
}

function toggleAutoPlayNext(checked) {
  localStorage.setItem('streamx_autoplay_next', checked ? 'true' : 'false');
  showToast(checked ? 'Auto-Play Next Episode Enabled' : 'Auto-Play Next Episode Disabled', checked ? 'fa-play' : 'fa-pause');
}

function switchServer(idx, btnEl) {
  if (!currentEpisode || !currentEpisode.servers || !currentEpisode.servers[idx]) return;

  const server = currentEpisode.servers[idx];
  const container = document.getElementById('videoPlayerFrame');
  if (!container) return;

  // Clean up any existing Plyr & Hls instances
  if (plyrInstance) {
    try { plyrInstance.destroy(); } catch(e) {}
    plyrInstance = null;
  }
  if (window._currentHls) {
    try {
      window._currentHls.destroy();
      window._currentHls = null;
    } catch(e) {}
  }

  // Toggle active button
  if (btnEl) {
    document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  const epSlug = currentEpisode.id || currentEpisode.slug || 'default';
  const resumeKey = `streamx_resume_${epSlug}`;
  const savedTime = parseFloat(localStorage.getItem(resumeKey) || '0');

  if (server.type === 'hls') {
    container.innerHTML = `<video id="hlsVideo" class="video-native" playsinline></video>`;
    const video = document.getElementById('hlsVideo');

    // Advanced Plyr Controls matching Live Movies / OTT Player
    const plyrOptions = {
      controls: [
        'play-large',
        'restart',
        'rewind',
        'play',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'settings',
        'pip',
        'airplay',
        'fullscreen'
      ],
      settings: ['quality', 'speed'],
      quality: {
        default: 0,
        options: [0, 1080, 720, 480, 360],
        forced: true,
        onChange: (newQuality) => {
          if (!window._currentHls) return;
          if (newQuality === 0) {
            window._currentHls.currentLevel = -1;
            showToast('Quality: Auto (Adaptive HD)', 'fa-sliders');
          } else {
            const targetH = parseInt(newQuality, 10);
            if (window._currentHls.levels && window._currentHls.levels.length > 0) {
              let bestIdx = 0;
              let minDiff = 99999;
              window._currentHls.levels.forEach((lvl, i) => {
                const diff = Math.abs((lvl.height || 0) - targetH);
                if (diff < minDiff) {
                  minDiff = diff;
                  bestIdx = i;
                }
              });
              window._currentHls.currentLevel = bestIdx;
              const actualH = window._currentHls.levels[bestIdx].height || targetH;
              showToast(`Quality: ${actualH}p HD`, 'fa-sliders');
            } else {
              showToast(`Quality: ${newQuality}p`, 'fa-sliders');
            }
          }
        }
      },
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      seekTime: 10,
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      i18n: {
        qualityLabel: {
          0: 'Auto'
        }
      }
    };

    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });
      window._currentHls = hls;
      hls.loadSource(server.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        // Read detected stream quality levels from HLS
        const availableQualities = hls.levels ? hls.levels.map(l => l.height).filter(Boolean) : [];
        const uniqueQualities = Array.from(new Set(availableQualities)).sort((a,b) => b - a);

        if (uniqueQualities.length > 0) {
          plyrOptions.quality = {
            default: 0,
            options: [0, ...uniqueQualities],
            forced: true,
            onChange: (newQuality) => {
              if (!window._currentHls) return;
              if (newQuality === 0) {
                window._currentHls.currentLevel = -1;
                showToast('Quality: Auto (Adaptive HD)', 'fa-sliders');
              } else {
                const targetH = parseInt(newQuality, 10);
                const idx = window._currentHls.levels.findIndex(lvl => lvl.height === targetH);
                if (idx !== -1) {
                  window._currentHls.currentLevel = idx;
                  showToast(`Quality: ${targetH}p HD`, 'fa-sliders');
                }
              }
            }
          };
        }

        // Initialize Plyr instance with controller settings
        plyrInstance = new Plyr(video, plyrOptions);

        // Mount Fullscreen Episodes Drawer inside the Player Container (visible in fullscreen)
        const plyrContainer = plyrInstance.elements ? plyrInstance.elements.container : container;
        initFsEpisodesDrawer(plyrContainer);

        // Resume Playback if saved
        if (savedTime > 15) {
          video.currentTime = savedTime;
          showToast(`Resumed playback at ${formatTime(savedTime)}`, 'fa-clock-rotate-left');
        }

        // Save progress periodically to localStorage & Watch History
        video.addEventListener('timeupdate', () => {
          if (video.currentTime > 5 && !video.ended) {
            localStorage.setItem(resumeKey, video.currentTime);
            saveToWatchHistory(currentEpisode, video.currentTime, video.duration);
          }
        });

        // Trigger Next Episode countdown when video ends
        video.addEventListener('ended', onEpisodeEnded);

        video.play().catch(e => console.log('Autoplay deferred:', e.message));
      });

      hls.on(Hls.Events.ERROR, function(event, data) {
        console.warn('HLS stream error:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (currentEpisode.servers && currentEpisode.servers[idx + 1]) {
                const nextBtn = document.querySelectorAll('.server-btn')[idx + 1];
                switchServer(idx + 1, nextBtn);
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = server.url;
      plyrInstance = new Plyr(video, plyrOptions);
      initFsEpisodesDrawer(plyrInstance.elements ? plyrInstance.elements.container : container);
      if (savedTime > 15) video.currentTime = savedTime;
      video.addEventListener('ended', onEpisodeEnded);
    }
  } else if (server.type === 'direct') {
    container.innerHTML = `<video id="hlsVideo" class="video-native" playsinline><source src="${server.url}" type="video/mp4"></video>`;
    const video = document.getElementById('hlsVideo');
    plyrInstance = new Plyr(video, {
      controls: ['play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
      settings: ['speed'],
      seekTime: 10
    });
    initFsEpisodesDrawer(plyrInstance.elements ? plyrInstance.elements.container : container);
    if (savedTime > 15) video.currentTime = savedTime;
    video.addEventListener('ended', onEpisodeEnded);
  } else {
    // embed - unblocked iframe
    container.innerHTML = `<iframe src="${server.url}" class="video-iframe" frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen referrerpolicy="no-referrer"></iframe>`;
    initFsEpisodesDrawer(container);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Countdown overlay and auto-navigate to Next Episode
function onEpisodeEnded() {
  const isAutoPlay = localStorage.getItem('streamx_autoplay_next') !== 'false';
  if (!isAutoPlay) return;

  const nextEp = (currentEpisodeIndex > 0) ? currentSerialEpisodes[currentEpisodeIndex - 1] : null;
  if (!nextEp) return;

  showNextEpisodeCountdownOverlay(nextEp);
}

function showNextEpisodeCountdownOverlay(nextEp) {
  const container = document.getElementById('videoPlayerFrame');
  if (!container) return;

  const epSlug = nextEp.id || nextEp.slug;
  let pathToken = '';
  if (nextEp.url) {
    const cleanRel = nextEp.url.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
    try { pathToken = btoa(cleanRel); } catch(e) {}
  }
  const nextUrl = pathToken
    ? `watch.html?v=${encodeURIComponent(epSlug)}&t=${encodeURIComponent(pathToken)}`
    : `watch.html?v=${encodeURIComponent(epSlug)}`;

  let secondsLeft = 5;
  const overlay = document.createElement('div');
  overlay.className = 'next-ep-overlay';
  overlay.id = 'nextEpOverlay';
  overlay.innerHTML = `
    <div class="next-ep-box">
      <div class="next-ep-subtitle"><i class="fa-solid fa-bolt"></i> Up Next in <span id="nextCountdown">${secondsLeft}</span>s</div>
      <div class="next-ep-title">${nextEp.title}</div>
      <div class="next-ep-actions">
        <a href="${nextUrl}" class="ep-nav-btn" style="background:var(--primary);color:#fff;border-color:var(--primary);">
          <i class="fa-solid fa-play"></i> Play Now
        </a>
        <button class="ep-nav-btn" onclick="cancelNextEpisodeCountdown()">
          <i class="fa-solid fa-xmark"></i> Cancel
        </button>
      </div>
    </div>
  `;
  container.appendChild(overlay);

  autoPlayCountdownTimer = setInterval(() => {
    secondsLeft -= 1;
    const countEl = document.getElementById('nextCountdown');
    if (countEl) countEl.innerText = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(autoPlayCountdownTimer);
      window.location.href = nextUrl;
    }
  }, 1000);
}

function cancelNextEpisodeCountdown() {
  if (autoPlayCountdownTimer) clearInterval(autoPlayCountdownTimer);
  const overlay = document.getElementById('nextEpOverlay');
  if (overlay) overlay.remove();
  showToast('Auto-play cancelled', 'fa-ban');
}

function toggleTheaterMode() {
  const container = document.getElementById('watchPlayerContainer');
  const btn = document.getElementById('theaterModeBtn');
  if (!container) return;

  container.classList.toggle('theater-mode');
  const isTheater = container.classList.contains('theater-mode');
  if (btn) {
    btn.innerHTML = isTheater
      ? `<i class="fa-solid fa-compress"></i> Standard View`
      : `<i class="fa-solid fa-film"></i> Theater Mode`;
  }
  showToast(isTheater ? 'Theater Mode ON' : 'Standard Mode ON', isTheater ? 'fa-film' : 'fa-compress');
}

function toggleCinemaLights() {
  document.body.classList.toggle('cinema-lights-off');
  const btn = document.getElementById('cinemaLightBtn');
  if (btn) {
    const isOff = document.body.classList.contains('cinema-lights-off');
    btn.innerHTML = isOff
      ? `<i class="fa-solid fa-lightbulb"></i> Lights ON`
      : `<i class="fa-regular fa-lightbulb"></i> Lights OFF`;
  }
}

// Global OTT Keyboard Shortcuts (L for Lights, T for Theater Mode, E for Episodes Drawer)
document.addEventListener('keydown', (e) => {
  if (['input', 'textarea', 'select'].includes((document.activeElement.tagName || '').toLowerCase())) return;
  if (!document.getElementById('watchPlayerContainer')) return;

  if (e.key === 'l' || e.key === 'L') {
    e.preventDefault();
    toggleCinemaLights();
  } else if (e.key === 't' || e.key === 'T') {
    e.preventDefault();
    toggleTheaterMode();
  } else if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    toggleFsEpisodesDrawer();
  } else if (e.key === 'Escape') {
    closeFsEpisodesDrawer();
  }
});

// ==================================================================
// 3. SHOW / ARCHIVE PAGE
// ==================================================================
let currentShowPage = 1;
let currentShowSlug = '';
let currentShowPath = '';
let isLoadingMoreShow = false;

async function initShowPage() {
  const params = new URLSearchParams(window.location.search);
  const showSlug = params.get('id') || params.get('show');
  let showPath = params.get('path') || '';
  const token = params.get('t');

  if (!showSlug && !token) {
    window.location.href = 'index.html';
    return;
  }

  if (token && !showPath) {
    try {
      showPath = atob(token);
    } catch(e) {}
  }

  currentShowSlug = showSlug;
  currentShowPath = showPath;
  currentShowPage = 1;

  const container = document.getElementById('showEpisodesContainer');
  const cleanTitle = (showSlug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  showLoader(container, `Securing Archive Connection for ${cleanTitle}...`);

  const titleEl = document.getElementById('showTitle');
  if (titleEl) titleEl.innerText = cleanTitle;

  let apiUrl = `/episodes?show=${encodeURIComponent(showSlug || '')}&page=1`;
  if (showPath) apiUrl += `&path=${encodeURIComponent(showPath)}`;

  const res = await apiGet(apiUrl);
  if (res && res.data && res.data.length > 0) {
    renderEpisodeCards(res.data, container);
    const brandName = window.APP_CONFIG ? window.APP_CONFIG.shortName : 'StreamX';
    document.title = `${cleanTitle} - All Episodes - ${brandName}`;

    // Set show poster from first episode
    const posterEl = document.getElementById('showPoster');
    if (posterEl && res.data[0] && res.data[0].thumbnail) {
      posterEl.src = res.data[0].thumbnail;
    }

    // Show 'Load More' button if there are episodes
    const moreWrap = document.getElementById('loadMoreWrap');
    if (moreWrap) {
      moreWrap.style.display = res.data.length >= 6 ? 'block' : 'none';
    }
  } else {
    showError(container, 'No archived episodes found for this show.');
  }
}

// Load Next Page of Archive Episodes
async function loadMoreEpisodes() {
  if (isLoadingMoreShow) return;
  const btn = document.getElementById('loadMoreBtn');
  const container = document.getElementById('showEpisodesContainer');
  if (!btn || !container) return;

  isLoadingMoreShow = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading More Episodes...`;
  btn.disabled = true;

  currentShowPage += 1;
  let apiUrl = `/episodes?show=${encodeURIComponent(currentShowSlug || '')}&page=${currentShowPage}`;
  if (currentShowPath) apiUrl += `&path=${encodeURIComponent(currentShowPath)}`;

  const res = await apiGet(apiUrl);
  if (res && res.data && res.data.length > 0) {
    appendEpisodeCards(res.data, container);
    btn.innerHTML = `<i class="fa-solid fa-angles-down"></i> Load More Episodes`;
    btn.disabled = false;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-check"></i> All Episodes Loaded`;
    btn.disabled = true;
    setTimeout(() => {
      const moreWrap = document.getElementById('loadMoreWrap');
      if (moreWrap) moreWrap.style.display = 'none';
    }, 2500);
  }
  isLoadingMoreShow = false;
}

// ==================================================================
// 4. SEARCH
// ==================================================================
function initSearch() {
  const input = document.getElementById('searchInput');
  const modal = document.getElementById('searchResultsModal');
  if (!input || !modal) return;

  let timer;
  input.addEventListener('input', (e) => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (q.length < 2) { modal.classList.remove('show'); return; }

    timer = setTimeout(async () => {
      modal.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="color:var(--primary);"></i> Searching shows & episodes...</div>`;
      modal.classList.add('show');

      const res = await apiGet(`/search?q=${encodeURIComponent(q)}`);
      if (res && res.results && res.results.length > 0) {
        modal.innerHTML = res.results.map(r => `
          <a href="watch.html?v=${encodeURIComponent(r.id)}" class="search-item">
            ${r.thumbnail ? `<img src="${r.thumbnail}" alt="${r.title}" onerror="this.src='/api/image'">` : ''}
            <div class="search-item-info">
              <h4>${r.title}</h4>
            </div>
          </a>
        `).join('');
      } else {
        modal.innerHTML = `<div style="padding:16px;text-align:center;color:#888;">No results found.</div>`;
      }
    }, 500);
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !modal.contains(e.target)) modal.classList.remove('show');
  });
}

// ==================================================================
// 5. AUTOMATIC INFINITE SCROLL OBSERVER
// ==================================================================
function setupInfiniteScroll() {
  if (!('IntersectionObserver' in window)) return;

  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        if (id === 'homeLoadMoreWrap' || id === 'homeLoadMoreBtn') {
          const btn = document.getElementById('homeLoadMoreBtn');
          if (btn && !btn.disabled && !isLoadingMoreHome) {
            loadMoreHomeEpisodes();
          }
        } else if (id === 'loadMoreWrap' || id === 'loadMoreBtn') {
          const btn = document.getElementById('loadMoreBtn');
          if (btn && !btn.disabled && !isLoadingMoreShow) {
            loadMoreEpisodes();
          }
        } else if (id === 'shelfMoreWrap' || id === 'shelfLoadMoreBtn') {
          const btn = document.getElementById('shelfLoadMoreBtn');
          if (btn && !btn.disabled && !isLoadingMoreShelf) {
            loadMoreShelfEpisodes();
          }
        }
      }
    });
  }, {
    root: null,
    rootMargin: '350px', // trigger 350px before reaching the bottom
    threshold: 0.1
  });

  // Watch elements if present
  const homeMore = document.getElementById('homeLoadMoreWrap');
  if (homeMore) scrollObserver.observe(homeMore);

  const showMore = document.getElementById('loadMoreWrap');
  if (showMore) scrollObserver.observe(showMore);

  const shelfMore = document.getElementById('shelfMoreWrap');
  if (shelfMore) scrollObserver.observe(shelfMore);
}

// Call infinite scroll setup on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(setupInfiniteScroll, 1200);
});

