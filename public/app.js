// StreamX Tamil - Frontend Application Engine

// Clean root domain URL: Remove index.html from address bar
(function cleanRootUrl() {
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.pathname.endsWith('/index.html') || window.location.pathname === '/index.html') {
      const cleanPath = window.location.pathname.replace(/\/index\.html$/, '') || '/';
      window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
    }
  }
})();

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
  const history = getWatchHistory();
  if (navItem) {
    navItem.style.display = history.length > 0 ? 'inline-block' : 'none';
  }
  const mobileQuickHistory = document.getElementById('mobileQuickHistory');
  if (mobileQuickHistory) {
    mobileQuickHistory.style.display = history.length > 0 ? 'inline-flex' : 'none';
  }
}

window.handleQuickNavClick = function(type, el) {
  document.querySelectorAll('.quick-nav-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');

  if (type === 'episodes') {
    if (typeof switchHomeView === 'function') switchHomeView('episodes');
    const target = document.getElementById('today-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else if (type === 'serials') {
    if (typeof switchHomeView === 'function') switchHomeView('serials');
    const target = document.getElementById('today-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else if (type === 'popular') {
    const target = document.getElementById('popular-shows');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else if (type === 'history') {
    const target = document.getElementById('history-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};


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

window.slideHistoryCarousel = function(direction) {
  const container = document.getElementById('historyCardsContainer');
  if (!container) return;
  const card = container.querySelector('.continue-card');
  const cardWidth = card ? (card.offsetWidth + 16) : 280;
  const delta = direction === 'left' ? -cardWidth * 2 : cardWidth * 2;
  container.scrollBy({ left: delta, behavior: 'smooth' });
};

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
    res.data.forEach(ep => {
      const s = ep.id || ep.slug;
      if (s && ep.thumbnail && ep.thumbnail !== '/api/image') {
        cacheEpisodeThumbnail(s, ep.thumbnail);
      }
    });
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

// Dedicated Episode Thumbnail Cache (Local Storage & Memory)
function cacheEpisodeThumbnail(slug, url) {
  if (!slug || !url || url === '/api/image' || url.includes('placeholder')) return;
  try {
    let map = JSON.parse(localStorage.getItem('streamx_thumbnails_cache') || '{}');
    map[slug] = url;
    const keys = Object.keys(map);
    if (keys.length > 300) {
      delete map[keys[0]];
    }
    localStorage.setItem('streamx_thumbnails_cache', JSON.stringify(map));
  } catch(e) {}
}

function getCachedEpisodeThumbnail(slug) {
  if (!slug) return null;
  try {
    const map = JSON.parse(localStorage.getItem('streamx_thumbnails_cache') || '{}');
    return map[slug] || null;
  } catch(e) {
    return null;
  }
}

// Universal Resolver for High-Def Video Thumbnails across Cards, Shelf & In-Player Drawer
function getCardThumbnail(ep, isCur = false) {
  const epSlug = ep.id || ep.slug;

  // 1. If currently playing episode on watch page, use currentEpisode.thumbnail
  if (isCur && currentEpisode && currentEpisode.thumbnail && currentEpisode.thumbnail !== '/api/image') {
    return currentEpisode.thumbnail;
  }

  // 2. Check dedicated thumbnail cache
  const cached = getCachedEpisodeThumbnail(epSlug);
  if (cached) return cached;

  // 3. Check Watch History
  const history = getWatchHistory();
  const histItem = history.find(h => (h.id === epSlug || h.slug === epSlug));
  if (histItem && histItem.thumbnail && histItem.thumbnail !== '/api/image') {
    return histItem.thumbnail;
  }

  // 4. If ep has thumbnail directly
  if (ep.thumbnail && ep.thumbnail !== '/api/image' && !ep.thumbnail.includes('placeholder')) {
    return ep.thumbnail;
  }

  // 5. If currentEpisode has thumbnail, use as show poster fallback
  if (currentEpisode && currentEpisode.thumbnail && currentEpisode.thumbnail !== '/api/image') {
    return currentEpisode.thumbnail;
  }

  return '/api/image';
}

// Background thumbnail enrichment for shelf & drawer episodes
function enrichShelfThumbnails(episodes) {
  if (!episodes || episodes.length === 0) return;
  // Pick the first 5 episodes that don't have a cached video thumbnail
  const candidates = episodes.slice(0, 5).filter(item => {
    const s = item.id || item.slug;
    return s && !getCachedEpisodeThumbnail(s);
  });

  if (candidates.length === 0) return;

  setTimeout(() => {
    candidates.forEach((cand, index) => {
      setTimeout(async () => {
        const cSlug = cand.id || cand.slug;
        let apiUrl = `/episode?slug=${encodeURIComponent(cSlug)}`;
        if (cand.url) apiUrl += `&url=${encodeURIComponent(cand.url)}`;
        try {
          const r = await apiGet(apiUrl);
          if (r && r.data && r.data.thumbnail && r.data.thumbnail !== '/api/image') {
            cacheEpisodeThumbnail(cSlug, r.data.thumbnail);
            cand.thumbnail = r.data.thumbnail;
            const imgs = document.querySelectorAll(`a[href*="${encodeURIComponent(cSlug)}"] img.card-thumb`);
            imgs.forEach(img => {
              if (img && (!img.src || img.src.includes('/api/image') || img.src.includes('placeholder'))) {
                img.src = r.data.thumbnail;
              }
            });
          }
        } catch(e) {}
      }, index * 800);
    });
  }, 1200);
}

// Generate single card HTML with OTT features
function buildEpisodeCardHtml(ep, isCur = false) {
  const thumb = getCardThumbnail(ep, isCur);
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
    window.location.href = '/';
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
  const curSlug = currentEpisode.id || currentEpisode.slug;
  if (curSlug && currentEpisode.thumbnail && currentEpisode.thumbnail !== '/api/image') {
    cacheEpisodeThumbnail(curSlug, currentEpisode.thumbnail);
  }
  renderPlayer(currentEpisode);
}

function renderPlayer(ep) {
  const brandName = window.APP_CONFIG ? window.APP_CONFIG.shortName : 'StreamX';
  document.title = `${ep.title || 'Episode'} - ${brandName}`;

  // Breadcrumbs
  const bc = document.getElementById('playerBreadcrumbs');
  if (bc) {
    bc.innerHTML = `
      <a href="/"><i class="fa-solid fa-house"></i> Home</a>
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

    // Setup Download button to open download modal
    const dlBtn = document.getElementById('downloadStreamBtn');
    if (dlBtn) {
      dlBtn.onclick = (e) => {
        e.preventDefault();
        openDownloadModal();
      };
      dlBtn.style.display = 'inline-flex';
      dlBtn.title = 'Click to download episode video (.ts/.mp4) or playlist';
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
  window._allSerialEpisodesLoaded = false;

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

  // Background thumbnail enrichment for shelf & drawer episodes
  enrichShelfThumbnails(currentSerialEpisodes);
}

// Fetch Next Page of Episodes for Watch Page Shelf
window.loadMoreShelfEpisodes = async function() {
  if (isLoadingMoreShelf || !currentShelfShowSlug || window._allSerialEpisodesLoaded) return;
  const btn = document.getElementById('shelfLoadMoreBtn');
  const drawerIcon = document.getElementById('fsLoadMoreDrawerIcon');
  const drawerTitle = document.getElementById('fsLoadMoreDrawerTitle');

  isLoadingMoreShelf = true;
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading More Episodes...`;
    btn.disabled = true;
  }
  if (drawerIcon) drawerIcon.className = 'fa-solid fa-spinner fa-spin';
  if (drawerTitle) drawerTitle.innerText = 'Loading...';

  currentShelfPage += 1;
  let apiUrl = `/episodes?show=${encodeURIComponent(currentShelfShowSlug)}&page=${currentShelfPage}`;
  if (currentShelfShowPath) apiUrl += `&path=${encodeURIComponent(currentShelfShowPath)}`;

  const res = await apiGet(apiUrl);
  if (res && res.data && res.data.length > 0) {
    let addedCount = 0;
    res.data.forEach(item => {
      const exists = currentSerialEpisodes.find(e => (e.id === item.id) || (e.slug === item.slug));
      if (!exists) {
        currentSerialEpisodes.push(item);
        addedCount++;
      }
    });

    if (addedCount === 0) {
      window._allSerialEpisodesLoaded = true;
    }

    renderSerialShelf();
    updateFsEpisodesDrawer();

    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-angles-down"></i> Load More Older Episodes`;
      btn.disabled = false;
    }
    showToast(`Loaded ${addedCount || res.data.length} more episodes`, 'fa-layer-group');
  } else {
    window._allSerialEpisodesLoaded = true;
    updateFsEpisodesDrawer();
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-check"></i> All Archived Episodes Loaded`;
      btn.disabled = true;
    }
    showToast('All episodes loaded for this serial', 'fa-check');
  }
  isLoadingMoreShelf = false;
};

// Drawer In-Player Trigger for Loading Next Batch
window.loadMoreFsDrawerEpisodes = async function(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (isLoadingMoreShelf || window._allSerialEpisodesLoaded) return;
  await window.loadMoreShelfEpisodes();
};

// ==================================================================
// FULLSCREEN IN-PLAYER OTT "MORE EPISODES" DRAWER & ADVANCED GESTURES
// ==================================================================
function setupPlayerOverlaysAndGestures(playerHost, video) {
  if (!playerHost) return;

  // 1. Mount Centered Gesture HUD Pill
  if (!playerHost.querySelector('#gestureHudPill')) {
    const hud = document.createElement('div');
    hud.className = 'gesture-hud-pill';
    hud.id = 'gestureHudPill';
    hud.innerHTML = `<i id="gestureHudIcon" class="fa-solid fa-play"></i> <span id="gestureHudText">Play</span>`;
    playerHost.appendChild(hud);
  }

  // 2. Mount Double-Tap Wave Ripples (Left & Right)
  if (!playerHost.querySelector('#gestureRippleLeft')) {
    const ripLeft = document.createElement('div');
    ripLeft.className = 'gesture-ripple left';
    ripLeft.id = 'gestureRippleLeft';
    ripLeft.innerHTML = `<i class="fa-solid fa-backward-step" style="font-size:1.8rem;"></i><span>10s</span>`;
    playerHost.appendChild(ripLeft);
  }
  if (!playerHost.querySelector('#gestureRippleRight')) {
    const ripRight = document.createElement('div');
    ripRight.className = 'gesture-ripple right';
    ripRight.id = 'gestureRippleRight';
    ripRight.innerHTML = `<i class="fa-solid fa-forward-step" style="font-size:1.8rem;"></i><span>10s</span>`;
    playerHost.appendChild(ripRight);
  }

  // Professional Studio OTT Vector Icons
  window.OTT_ICONS = {
    rotate: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>`,
    lockOpen: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
    lockClosed: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5" fill="currentColor" fill-opacity="0.25"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
  };

  // 3. Mount Fullscreen Rotate & Lock Buttons
  if (!playerHost.querySelector('#fsRotateBtn')) {
    const rotBtn = document.createElement('button');
    rotBtn.type = 'button';
    rotBtn.className = 'fs-rotate-btn';
    rotBtn.id = 'fsRotateBtn';
    rotBtn.title = 'Rotate Screen Orientation (Landscape/Portrait)';
    rotBtn.innerHTML = window.OTT_ICONS.rotate;
    rotBtn.style.display = 'none';
    rotBtn.onclick = (e) => toggleScreenRotation(e);
    playerHost.appendChild(rotBtn);
  }

  if (!playerHost.querySelector('#fsLockBtn')) {
    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'fs-lock-btn';
    lockBtn.id = 'fsLockBtn';
    lockBtn.title = 'Lock Screen Controls';
    lockBtn.innerHTML = window.OTT_ICONS.lockOpen;
    lockBtn.style.display = 'none';
    lockBtn.onclick = (e) => togglePlayerLock(e);
    playerHost.appendChild(lockBtn);
  }

  // 4. Mount In-Player Episodes Drawer
  initFsEpisodesDrawer(playerHost);

  // 5. Attach Touch Gesture Engine
  if (video) {
    attachPlayerGestures(playerHost, video);
  }
}

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
        ${window.OTT_ICONS ? window.OTT_ICONS.close : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'}
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
  if (!carousel) return;

  if (countEl && currentSerialEpisodes) {
    countEl.innerText = `${currentSerialEpisodes.length} Episodes`;
  }

  if (!currentSerialEpisodes || currentSerialEpisodes.length === 0) {
    carousel.innerHTML = `<div style="padding:20px;color:var(--text-muted);font-size:0.85rem;">Loading serial episodes...</div>`;
    return;
  }

  const currentSlug = currentEpisode ? (currentEpisode.id || currentEpisode.slug) : '';

  let html = currentSerialEpisodes.map(ep => {
    const isCur = currentSlug && ((ep.id === currentSlug) || (ep.slug === currentSlug) ||
      (currentEpisode && currentEpisode.title && ep.title && ep.title.trim().toLowerCase() === currentEpisode.title.trim().toLowerCase()));

    const thumb = getCardThumbnail(ep, isCur);
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

  // Persistent 'Load More Older Episodes' Button Card at the End of Carousel
  if (!window._allSerialEpisodesLoaded) {
    html += `
      <div class="fs-ep-card fs-ep-load-more" id="fsLoadMoreDrawerCard" onclick="loadMoreFsDrawerEpisodes(event)">
        <div class="fs-load-more-icon">
          <i class="fa-solid ${isLoadingMoreShelf ? 'fa-spinner fa-spin' : 'fa-angles-right'}" id="fsLoadMoreDrawerIcon"></i>
        </div>
        <div class="fs-load-more-title" id="fsLoadMoreDrawerTitle">${isLoadingMoreShelf ? 'Loading...' : 'Load More Older'}</div>
        <div class="fs-load-more-sub">Swipe or Tap</div>
      </div>
    `;
  } else {
    html += `
      <div class="fs-ep-card fs-ep-load-more" style="opacity:0.65;cursor:default;">
        <div class="fs-load-more-icon" style="background:#00d26a;">
          <i class="fa-solid fa-check"></i>
        </div>
        <div class="fs-load-more-title">All Episodes Loaded</div>
        <div class="fs-load-more-sub">Complete Series</div>
      </div>
    `;
  }

  const prevScrollLeft = carousel.scrollLeft;
  carousel.innerHTML = html;
  if (prevScrollLeft > 0) {
    carousel.scrollLeft = prevScrollLeft;
  }

  // Horizontal scroll listener on carousel: reaching right edge auto-loads older episodes!
  if (!carousel._hasInfiniteScrollBound) {
    carousel._hasInfiniteScrollBound = true;
    let scrollDebounce = false;
    carousel.addEventListener('scroll', () => {
      if (scrollDebounce || isLoadingMoreShelf || window._allSerialEpisodesLoaded) return;
      if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 160) {
        scrollDebounce = true;
        window.loadMoreFsDrawerEpisodes().finally(() => {
          setTimeout(() => { scrollDebounce = false; }, 800);
        });
      }
    }, { passive: true });
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

  // Scroll carousel horizontally to active playing episode
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

// Touch swipe gestures for drawer sheet
function attachDrawerSwipeGestures(host, drawer) {
  let touchStartY = 0;
  let touchStartX = 0;

  // Swipe DOWN on drawer closes drawer sheet
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

// ==================================================================
// ADVANCED PLAYER GESTURES, HUD, ROTATE & CONTROLS LOCK
// ==================================================================
let gestureAttachedToVideo = null;
let isPlayerControlsLocked = false;
let unlockTimeout = null;
let hudTimeout = null;

function showPlayerHud(text, iconClass = 'fa-play') {
  if (!text || text.startsWith('Play') || text.startsWith('Pause')) return; // Do not disturb video playback
  const hud = document.getElementById('gestureHudPill');
  const icon = document.getElementById('gestureHudIcon');
  const label = document.getElementById('gestureHudText');
  if (!hud) return;

  if (icon) icon.className = `fa-solid ${iconClass}`;
  if (label) label.innerText = text;

  hud.classList.add('show');
  clearTimeout(hudTimeout);
  hudTimeout = setTimeout(() => {
    hud.classList.remove('show');
  }, 650);
}

function triggerGestureRipple(side) {
  const rip = document.getElementById(side === 'left' ? 'gestureRippleLeft' : 'gestureRippleRight');
  if (!rip) return;
  rip.classList.remove('active');
  void rip.offsetWidth; // Force CSS animation restart
  rip.classList.add('active');
  setTimeout(() => {
    rip.classList.remove('active');
  }, 500);
}

function toggleScreenRotation(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (screen.orientation && screen.orientation.lock) {
    const type = (screen.orientation.type || '').toLowerCase();
    if (type.startsWith('portrait')) {
      screen.orientation.lock('landscape').then(() => {
        showPlayerHud('Landscape Mode', 'fa-mobile-screen');
      }).catch(() => {});
    } else {
      screen.orientation.lock('portrait').then(() => {
        showPlayerHud('Portrait Mode', 'fa-mobile-screen');
      }).catch(() => {});
    }
  } else {
    showPlayerHud('Screen Rotation Toggled', 'fa-arrows-rotate');
  }
}

function togglePlayerLock(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  isPlayerControlsLocked = !isPlayerControlsLocked;
  const lockBtn = document.getElementById('fsLockBtn');
  const playerHost = document.getElementById('videoPlayerFrame');
  const plyrContainer = playerHost ? (playerHost.querySelector('.plyr') || playerHost) : null;

  if (isPlayerControlsLocked) {
    if (lockBtn) {
      lockBtn.classList.add('locked');
      lockBtn.innerHTML = window.OTT_ICONS ? window.OTT_ICONS.lockClosed : '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5" fill="currentColor" fill-opacity="0.25"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
      lockBtn.title = 'Screen is Locked. Tap to Unlock';
      lockBtn.style.opacity = '1';
    }
    if (plyrContainer) plyrContainer.classList.add('plyr--hide-controls');
    showPlayerHud('Controls Locked', 'fa-lock');

    clearTimeout(unlockTimeout);
    unlockTimeout = setTimeout(() => {
      if (lockBtn && isPlayerControlsLocked) lockBtn.style.opacity = '0.35';
    }, 2500);
  } else {
    if (lockBtn) {
      lockBtn.classList.remove('locked');
      lockBtn.innerHTML = window.OTT_ICONS ? window.OTT_ICONS.lockOpen : '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-svg"><rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
      lockBtn.title = 'Lock Screen Controls';
      lockBtn.style.opacity = '1';
    }
    if (plyrContainer) plyrContainer.classList.remove('plyr--hide-controls');
    showPlayerHud('Controls Unlocked', 'fa-lock-open');
  }
}

function handleFullscreenChange() {
  const isFs = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    (plyrInstance && plyrInstance.fullscreen && plyrInstance.fullscreen.active)
  );

  const rotateBtn = document.getElementById('fsRotateBtn');
  const lockBtn = document.getElementById('fsLockBtn');

  if (isFs) {
    if (rotateBtn) rotateBtn.style.display = 'flex';
    if (lockBtn) lockBtn.style.display = 'flex';

    // Auto-lock to landscape on mobile / touch screen
    if (window.innerWidth <= 1024 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (err) {}
    }
  } else {
    if (rotateBtn) rotateBtn.style.display = 'none';
    if (lockBtn) lockBtn.style.display = 'none';

    // Auto-revert to portrait & unlock
    try {
      if (screen.orientation) {
        if (screen.orientation.lock) {
          screen.orientation.lock('portrait').then(() => {
            if (screen.orientation.unlock) screen.orientation.unlock();
          }).catch(() => {
            if (screen.orientation.unlock) screen.orientation.unlock();
          });
        } else if (screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      }
    } catch (err) {}

    // Unlock controls if previously locked
    if (isPlayerControlsLocked) {
      togglePlayerLock();
    }
  }
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function attachPlayerGestures(host, video) {
  if (gestureAttachedToVideo === video) return;
  gestureAttachedToVideo = video;

  let touchStartX = 0;
  let touchStartY = 0;
  let startVideoTime = 0;
  let startBrightness = 1.0;
  let currentBrightness = 1.0;
  let startVolume = 1.0;
  let isSwiping = false;
  let swipeType = ''; // 'h' (seek), 'v_bright' (brightness), 'v_vol' (volume), 'bottom_sheet' (episodes)

  let startPinchDist = 0;
  let initialScale = 1.0;
  let currentScale = 1.0;

  let tapCount = 0;
  let tapTimeout = null;
  let lastTouchEndTime = 0;

  // 2X Fast-Forward Hold State
  let holdTimer = null;
  let isHolding2x = false;
  let previousPlaybackRate = 1.0;

  function isExcluded(target) {
    return !!(
      target.closest('.plyr__controls') ||
      target.closest('.fs-episodes-drawer') ||
      target.closest('.fs-episodes-pill') ||
      target.closest('#fsDrawerBackdrop') ||
      target.closest('#downloadModal') ||
      target.closest('.next-ep-overlay') ||
      target.id === 'fsRotateBtn' ||
      target.closest('#fsRotateBtn') ||
      target.id === 'fsLockBtn' ||
      target.closest('#fsLockBtn')
    );
  }

  let playerControlsTimer = null;

  function isPlayerControlsVisible() {
    const playerHost = document.getElementById('videoPlayerFrame');
    const plyrContainer = playerHost ? (playerHost.querySelector('.plyr') || playerHost) : null;
    if (!plyrContainer) return false;
    return !plyrContainer.classList.contains('plyr--hide-controls');
  }

  function showPlayerControls(autoHideMs = 7000) {
    const playerHost = document.getElementById('videoPlayerFrame');
    const plyrContainer = playerHost ? (playerHost.querySelector('.plyr') || playerHost) : null;
    if (!plyrContainer) return;

    plyrContainer.classList.remove('plyr--hide-controls');
    const rotateBtn = document.getElementById('fsRotateBtn');
    const lockBtn = document.getElementById('fsLockBtn');
    if (rotateBtn) rotateBtn.style.opacity = '1';
    if (lockBtn && !isPlayerControlsLocked) lockBtn.style.opacity = '1';

    if (playerControlsTimer) {
      clearTimeout(playerControlsTimer);
      playerControlsTimer = null;
    }

    if (autoHideMs > 0) {
      playerControlsTimer = setTimeout(() => {
        // Keep visible if user is interacting with settings menu
        const isMenuOpen = plyrContainer.querySelector('.plyr__menu--active') ||
                           plyrContainer.querySelector('.plyr__menu[aria-expanded="true"]');
        if (isMenuOpen) {
          showPlayerControls(7000);
          return;
        }
        if (video && video.paused) return; // Keep controls visible while paused
        hidePlayerControls();
      }, autoHideMs);
    }
  }

  function hidePlayerControls() {
    const playerHost = document.getElementById('videoPlayerFrame');
    const plyrContainer = playerHost ? (playerHost.querySelector('.plyr') || playerHost) : null;
    if (!plyrContainer) return;

    if (video && video.paused) return; // Never hide controls while paused

    const isMenuOpen = plyrContainer.querySelector('.plyr__menu--active') ||
                       plyrContainer.querySelector('.plyr__menu[aria-expanded="true"]');
    if (isMenuOpen) return;

    plyrContainer.classList.add('plyr--hide-controls');
    const rotateBtn = document.getElementById('fsRotateBtn');
    const lockBtn = document.getElementById('fsLockBtn');
    if (rotateBtn) rotateBtn.style.opacity = '0';
    if (lockBtn && !isPlayerControlsLocked) lockBtn.style.opacity = '0';
  }

  function togglePlayerControls() {
    if (isPlayerControlsVisible()) {
      hidePlayerControls();
    } else {
      showPlayerControls(7000);
    }
  }

  // Keep controls alive when playing or pausing
  video.addEventListener('play', () => showPlayerControls(7000));
  video.addEventListener('pause', () => showPlayerControls(0));

  // Keep controls alive on any touch inside plyr__controls
  const controlsEl = host.querySelector('.plyr__controls');
  if (controlsEl) {
    ['touchstart', 'pointerdown', 'mousedown', 'input', 'change'].forEach(evName => {
      controlsEl.addEventListener(evName, () => {
        showPlayerControls(7000);
      }, { passive: true });
    });
  }

  function toggleVideoPlayPause() {
    if (!video) return;
    if (video.paused) {
      if (plyrInstance && typeof plyrInstance.play === 'function') {
        plyrInstance.play().catch(() => video.play());
      } else {
        video.play();
      }
      showPlayerControls(7000);
    } else {
      if (plyrInstance && typeof plyrInstance.pause === 'function') {
        plyrInstance.pause();
      } else {
        video.pause();
      }
      showPlayerControls(0);
    }
  }

  // Touch Start
  host.addEventListener('touchstart', (e) => {
    if (isExcluded(e.target)) return;

    if (isPlayerControlsLocked) {
      if (e.target.id !== 'fsLockBtn' && !e.target.closest('#fsLockBtn')) {
        showPlayerHud('Screen Locked - Tap lock icon to unlock', 'fa-lock');
        const lockBtn = document.getElementById('fsLockBtn');
        if (lockBtn) {
          lockBtn.style.opacity = '1';
          clearTimeout(unlockTimeout);
          unlockTimeout = setTimeout(() => {
            if (isPlayerControlsLocked) lockBtn.style.opacity = '0.3';
          }, 2000);
        }
      }
      return;
    }

    // 2-Finger Pinch to Zoom
    if (e.touches.length === 2) {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startPinchDist = Math.hypot(dx, dy);
      initialScale = currentScale;
      return;
    }

    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      startVideoTime = video.currentTime;
      startVolume = typeof video.volume === 'number' ? video.volume : 1.0;
      isSwiping = false;
      swipeType = '';

      // Start 2X Fast-Forward Hold Timer (400ms hold)
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (!isSwiping && !isPlayerControlsLocked) {
          isHolding2x = true;
          previousPlaybackRate = video.playbackRate || 1.0;
          video.playbackRate = 2.0;
          showPlayerHud('2X Fast Forward ⏩', 'fa-forward');
          if (navigator.vibrate) {
            try { navigator.vibrate(40); } catch(err) {}
          }
        }
      }, 400);
    }
  }, { passive: true });

  // Touch Move
  host.addEventListener('touchmove', (e) => {
    if (isExcluded(e.target) || isPlayerControlsLocked) return;

    // Pinch Zoom Handling
    if (e.touches.length === 2 && startPinchDist > 0) {
      if (e.cancelable) e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      currentScale = Math.max(0.7, Math.min(3.0, initialScale * (dist / startPinchDist)));
      video.style.transform = `scale(${currentScale})`;
      video.style.objectFit = 'contain';
      showPlayerHud(`Zoom ${currentScale.toFixed(2)}x`, 'fa-magnifying-glass');
      return;
    }

    if (e.touches.length !== 1) return;

    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    const deltaX = curX - touchStartX;
    const deltaY = touchStartY - curY; // swipe up is positive
    const rect = host.getBoundingClientRect();

    // If moved more than 14px, cancel 2X hold timer
    if (Math.hypot(deltaX, deltaY) > 14) {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }

    // Determine gesture type once per gesture
    if (!swipeType) {
      // Bottom Sheet Check: If touch started in bottom 65px and swipes up predominantly
      if (touchStartY > rect.bottom - 65 && deltaY > 18 && Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeType = 'bottom_sheet';
      } else if (Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeType = 'h'; // Horizontal seek
      } else if (Math.abs(deltaY) > 18) {
        if (touchStartX < rect.left + (rect.width / 2)) {
          swipeType = 'v_bright'; // Left half vertical -> Brightness
        } else {
          swipeType = 'v_vol'; // Right half vertical -> Volume ONLY!
        }
      }
    }

    if (swipeType === 'bottom_sheet') {
      isSwiping = true;
      if (e.cancelable) e.preventDefault();
      if (deltaY > 50) {
        openFsEpisodesDrawer();
        showPlayerHud('More Episodes', 'fa-layer-group');
        swipeType = 'bottom_sheet_opened'; // trigger once per gesture
      }
    } else if (swipeType === 'h') {
      isSwiping = true;
      if (e.cancelable) e.preventDefault();
      const duration = video.duration || 1200;
      const seekAmount = (deltaX / rect.width) * 120; // 120s full span
      const targetTime = Math.max(0, Math.min(duration, startVideoTime + seekAmount));
      video.currentTime = targetTime;
      showPlayerHud(`${formatTime(targetTime)} / ${formatTime(duration)}`, 'fa-clock');
    } else if (swipeType === 'v_bright') {
      isSwiping = true;
      if (e.cancelable) e.preventDefault();
      const brightDelta = deltaY / 220;
      currentBrightness = Math.max(0.2, Math.min(2.0, startBrightness + brightDelta));
      video.style.filter = `brightness(${currentBrightness})`;
      const pct = Math.round((currentBrightness / 2.0) * 100);
      showPlayerHud(`Brightness ${pct}%`, 'fa-sun');
    } else if (swipeType === 'v_vol') {
      isSwiping = true;
      if (e.cancelable) e.preventDefault();
      const volDelta = deltaY / 220;
      const newVol = Math.max(0, Math.min(1, startVolume + volDelta));
      video.volume = newVol;
      const volPct = Math.round(newVol * 100);
      let volIcon = 'fa-volume-high';
      if (newVol === 0) volIcon = 'fa-volume-xmark';
      else if (newVol < 0.5) volIcon = 'fa-volume-low';
      showPlayerHud(`Volume ${volPct}%`, volIcon);
    }
  }, { passive: false });

  // Touch End
  host.addEventListener('touchend', (e) => {
    if (isExcluded(e.target) || isPlayerControlsLocked) return;
    lastTouchEndTime = Date.now();

    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    // Revert 2X Fast-Forward on release
    if (isHolding2x) {
      isHolding2x = false;
      video.playbackRate = previousPlaybackRate || 1.0;
      showPlayerHud(`${video.playbackRate}X Speed (Normal)`, 'fa-play');
      return; // Skip tap actions on hold release
    }

    if (isSwiping) {
      isSwiping = false;
      startBrightness = currentBrightness;
      return;
    }

    if (e.changedTouches && e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const rect = host.getBoundingClientRect();
      const relX = endX - rect.left;
      const widthPct = relX / rect.width;

      tapCount++;
      if (tapCount === 1) {
        tapTimeout = setTimeout(() => {
          tapCount = 0;
          // Single Tap: Toggle Controller overlay
          togglePlayerControls();
        }, 280);
      } else if (tapCount === 2) {
        clearTimeout(tapTimeout);
        tapCount = 0;
        if (e.cancelable) e.preventDefault();

        // Double Tap Smart Zones:
        // Left 33%: Rewind -10s
        // Center 34%: Pause / Play toggle
        // Right 33%: Fast Forward +10s
        if (widthPct < 0.33) {
          video.currentTime = Math.max(0, video.currentTime - 10);
          triggerGestureRipple('left');
          showPlayerHud('-10s Rewind', 'fa-backward-step');
        } else if (widthPct > 0.67) {
          video.currentTime = Math.min(video.duration || 9999, video.currentTime + 10);
          triggerGestureRipple('right');
          showPlayerHud('+10s Forward', 'fa-forward-step');
        } else {
          toggleVideoPlayPause();
        }
      }
    }
  }, { passive: false });

  // Touch Cancel
  host.addEventListener('touchcancel', () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (isHolding2x) {
      isHolding2x = false;
      video.playbackRate = previousPlaybackRate || 1.0;
      showPlayerHud(`${video.playbackRate}X Speed (Normal)`, 'fa-play');
    }
    isSwiping = false;
    tapCount = 0;
  });

  // Keep controls alive on mouse interaction
  host.addEventListener('mousemove', (e) => {
    if (!isExcluded(e.target) && !isPlayerControlsLocked) {
      showPlayerControls(4000);
    }
  });

  // Suppress browser double click zoom
  host.addEventListener('dblclick', (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  });

  // Desktop Mouse Wheel Support (Scroll Left = Brightness, Scroll Right = Volume)
  host.addEventListener('wheel', (e) => {
    if (isExcluded(e.target) || isPlayerControlsLocked) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const direction = e.deltaY < 0 ? 1 : -1; // up = positive, down = negative

    if (relX < rect.width / 2) {
      // Left side: Brightness +/- 5%
      startBrightness = Math.max(0.2, Math.min(2.0, (startBrightness || 1.0) + (direction * 0.08)));
      video.style.filter = `brightness(${startBrightness})`;
      const pct = Math.round((startBrightness / 2.0) * 100);
      showPlayerHud(`Brightness ${pct}%`, 'fa-sun');
    } else {
      // Right side: Volume +/- 5%
      const curVol = typeof video.volume === 'number' ? video.volume : 1.0;
      const newVol = Math.max(0, Math.min(1, curVol + (direction * 0.05)));
      video.volume = newVol;
      const volPct = Math.round(newVol * 100);
      let volIcon = 'fa-volume-high';
      if (newVol === 0) volIcon = 'fa-volume-xmark';
      else if (newVol < 0.5) volIcon = 'fa-volume-low';
      showPlayerHud(`Volume ${volPct}%`, volIcon);
    }
  }, { passive: false });

  // Desktop Mouse Support (Hold for 2X, Single Click for Controls, Double Click for Pause/Play / Seek)
  let mouseHoldTimer = null;
  let isMouseHolding2x = false;
  let clickCount = 0;
  let clickTimeout = null;

  host.addEventListener('mousedown', (e) => {
    if (isExcluded(e.target) || isPlayerControlsLocked || e.button !== 0) return;
    if (Date.now() - lastTouchEndTime < 600) return;

    if (mouseHoldTimer) clearTimeout(mouseHoldTimer);
    mouseHoldTimer = setTimeout(() => {
      isMouseHolding2x = true;
      previousPlaybackRate = video.playbackRate || 1.0;
      video.playbackRate = 2.0;
      showPlayerHud('2X Fast Forward ⏩', 'fa-forward');
    }, 400);
  });

  host.addEventListener('mouseup', (e) => {
    if (mouseHoldTimer) {
      clearTimeout(mouseHoldTimer);
      mouseHoldTimer = null;
    }
    if (isMouseHolding2x) {
      isMouseHolding2x = false;
      video.playbackRate = previousPlaybackRate || 1.0;
      showPlayerHud(`${video.playbackRate}X Speed (Normal)`, 'fa-play');
    }
  });

  host.addEventListener('click', (e) => {
    if (isExcluded(e.target) || isPlayerControlsLocked || e.button !== 0) return;
    if (Date.now() - lastTouchEndTime < 600) return;
    if (isMouseHolding2x) return;

    const rect = host.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const widthPct = relX / rect.width;

    clickCount++;
    if (clickCount === 1) {
      clickTimeout = setTimeout(() => {
        clickCount = 0;
        togglePlayerControls();
      }, 260);
    } else if (clickCount === 2) {
      clearTimeout(clickTimeout);
      clickCount = 0;

      if (widthPct < 0.33) {
        video.currentTime = Math.max(0, video.currentTime - 10);
        triggerGestureRipple('left');
        showPlayerHud('-10s Rewind', 'fa-backward-step');
      } else if (widthPct > 0.67) {
        video.currentTime = Math.min(video.duration || 9999, video.currentTime + 10);
        triggerGestureRipple('right');
        showPlayerHud('+10s Forward', 'fa-forward-step');
      } else {
        toggleVideoPlayPause();
      }
    }
  });
}

// ==================================================================
// DOWNLOAD OPTIONS MODAL & CLIPBOARD ENGINE
// ==================================================================
window.openDownloadModal = function() {
  const modal = document.getElementById('downloadModal');
  if (!modal || !currentEpisode) return;

  let videoId = currentEpisode.videoId || '';
  if (!videoId && currentEpisode.servers) {
    for (const s of currentEpisode.servers) {
      if (s.url && s.url.includes('v=')) {
        const match = s.url.match(/v=([^&]+)/);
        if (match) { videoId = match[1]; break; }
      }
    }
  }

  const title = currentEpisode.title || 'Episode';
  const titleEl = document.getElementById('dlEpisodeTitle');
  if (titleEl) titleEl.innerText = title;

  const optionsContainer = modal.querySelector('.download-options-list');
  const safeTitle = encodeURIComponent(title);
  const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'streamx_episode';

  if (optionsContainer && videoId) {
    let html = '';
    const qualities = window._currentStreamQualities || [];

    if (qualities.length > 1) {
      const qMeta = {
        1080: { label: '1080p Full HD', note: 'Ultra-crisp master stream', color: '#e50914' },
        720: { label: '720p HD Video', note: 'Recommended high definition', color: '#00d26a' },
        480: { label: '480p SD Video', note: 'Standard resolution & fast download', color: '#ffb703' },
        360: { label: '360p Mobile Saver', note: 'Low file size for mobile data', color: '#38bdf8' }
      };

      qualities.forEach(q => {
        const meta = qMeta[q] || { label: `${q}p Video`, note: 'Playable video file', color: '#00d26a' };
        const dlUrl = `/api/download?v=${encodeURIComponent(videoId)}&title=${safeTitle}&format=ts&quality=${q}`;
        html += `
          <a href="${dlUrl}" class="download-opt-card" download="${cleanTitle}_${q}p.ts">
            <div class="download-opt-icon" style="background:${meta.color}22; color:${meta.color};">
              <i class="fa-solid fa-file-video"></i>
            </div>
            <div class="download-opt-info">
              <h4>${meta.label}</h4>
              <p>${meta.note}</p>
            </div>
            <span class="card-tag" style="position:static; background:${meta.color}; color:#000; font-weight:800;">
              <i class="fa-solid fa-download"></i> ${q}p
            </span>
          </a>
        `;
      });
    } else {
      const singleQ = (qualities.length === 1 && qualities[0]) ? `${qualities[0]}p HD` : '720p HD';
      html += `
        <a href="/api/download?v=${encodeURIComponent(videoId)}&title=${safeTitle}&format=ts" class="download-opt-card" download="${cleanTitle}.ts">
          <div class="download-opt-icon">
            <i class="fa-solid fa-file-video"></i>
          </div>
          <div class="download-opt-info">
            <h4>Direct Video File (${singleQ})</h4>
            <p>Single video file for offline playback in any media player</p>
          </div>
          <span class="card-tag" style="position:static; background:var(--primary);"><i class="fa-solid fa-download"></i> Save</span>
        </a>
      `;
    }

    // M3U8 Downloader Option
    html += `
      <a href="/api/download?v=${encodeURIComponent(videoId)}&title=${safeTitle}&format=m3u8" class="download-opt-card" download="${cleanTitle}.m3u8">
        <div class="download-opt-icon" style="background:rgba(0,210,106,0.15); color:#00d26a;">
          <i class="fa-solid fa-bolt"></i>
        </div>
        <div class="download-opt-info">
          <h4>1DM / ADM / VLC Downloader (.m3u8)</h4>
          <p>High-speed multi-threaded downloader playlist file</p>
        </div>
        <span class="card-tag" style="position:static; background:#00d26a; color:#000;">Fast 1DM</span>
      </a>
    `;

    // Copy Direct Stream URL
    html += `
      <button type="button" class="download-opt-card" onclick="copyStreamDownloadLink()">
        <div class="download-opt-icon" style="background:rgba(255,183,3,0.15); color:#ffb703;">
          <i class="fa-solid fa-copy"></i>
        </div>
        <div class="download-opt-info">
          <h4>Copy Direct Stream URL</h4>
          <p>Paste into VLC, MX Player, or your mobile downloader app</p>
        </div>
        <span class="card-tag" style="position:static; background:#202431; color:var(--text-muted);"><i class="fa-solid fa-clipboard"></i> Copy</span>
      </button>
    `;

    optionsContainer.innerHTML = html;
  } else if (optionsContainer && currentEpisode.servers && currentEpisode.servers[0] && currentEpisode.servers[0].type === 'direct') {
    const directUrl = currentEpisode.servers[0].url;
    optionsContainer.innerHTML = `
      <a href="${directUrl}" class="download-opt-card" download="${cleanTitle}.mp4">
        <div class="download-opt-icon"><i class="fa-solid fa-file-video"></i></div>
        <div class="download-opt-info">
          <h4>Direct MP4 Video File</h4>
          <p>Download video file directly for offline viewing</p>
        </div>
        <span class="card-tag" style="position:static; background:var(--primary);"><i class="fa-solid fa-download"></i> MP4</span>
      </a>
    `;
  }

  modal.classList.add('show');
};

window.closeDownloadModal = function(e) {
  if (e && e.target !== e.currentTarget && !e.target.closest('.fs-drawer-close-btn')) return;
  const modal = document.getElementById('downloadModal');
  if (modal) modal.classList.remove('show');
};

window.copyStreamDownloadLink = function() {
  let videoId = currentEpisode ? currentEpisode.videoId : '';
  if (!videoId && currentEpisode && currentEpisode.servers) {
    for (const s of currentEpisode.servers) {
      if (s.url && s.url.includes('v=')) {
        const match = s.url.match(/v=([^&]+)/);
        if (match) { videoId = match[1]; break; }
      }
    }
  }

  const streamUrl = videoId
    ? `${window.location.origin}/api/hls?v=${encodeURIComponent(videoId)}`
    : (currentEpisode && currentEpisode.servers && currentEpisode.servers[0] ? currentEpisode.servers[0].url : window.location.href);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(streamUrl).then(() => {
      showToast('Stream URL copied to clipboard!', 'fa-copy');
    }).catch(() => {
      fallbackCopyText(streamUrl);
    });
  } else {
    fallbackCopyText(streamUrl);
  }
};

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Stream URL copied to clipboard!', 'fa-copy');
  } catch (err) {
    showToast('Failed to copy URL', 'fa-triangle-exclamation');
  }
  document.body.removeChild(ta);
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
      hideControls: false, // We control auto-hide smoothly without Plyr abrupt conflicts
      clickToPlay: false,
      toggleControls: false,
      settings: ['speed'],
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
        const availableQualities = hls.levels ? hls.levels.map(l => l.height).filter(h => typeof h === 'number' && h > 0) : [];
        const uniqueQualities = Array.from(new Set(availableQualities)).sort((a,b) => b - a);
        window._currentStreamQualities = uniqueQualities.length > 0 ? uniqueQualities : [720];

        // Only attach Quality switcher if source ACTUALLY provides multiple qualities!
        if (uniqueQualities.length > 1) {
          plyrOptions.settings = ['quality', 'speed'];
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
        } else {
          plyrOptions.settings = ['speed'];
          delete plyrOptions.quality;
        }

        // Initialize Plyr instance with controller settings
        plyrInstance = new Plyr(video, plyrOptions);

        // Mount Fullscreen Episodes Drawer & Overlays inside the Player Container
        const plyrContainer = plyrInstance.elements ? plyrInstance.elements.container : container;
        setupPlayerOverlaysAndGestures(plyrContainer, video);

        plyrInstance.on('enterfullscreen', () => handleFullscreenChange());
        plyrInstance.on('exitfullscreen', () => handleFullscreenChange());

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
      const plyrContainer = plyrInstance.elements ? plyrInstance.elements.container : container;
      setupPlayerOverlaysAndGestures(plyrContainer, video);
      plyrInstance.on('enterfullscreen', () => handleFullscreenChange());
      plyrInstance.on('exitfullscreen', () => handleFullscreenChange());
      if (savedTime > 15) video.currentTime = savedTime;
      video.addEventListener('ended', onEpisodeEnded);
    }
  } else if (server.type === 'direct') {
    container.innerHTML = `<video id="hlsVideo" class="video-native" playsinline><source src="${server.url}" type="video/mp4"></video>`;
    const video = document.getElementById('hlsVideo');
    plyrInstance = new Plyr(video, {
      controls: ['play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
      settings: ['speed'],
      clickToPlay: false,
      seekTime: 10
    });
    const plyrContainer = plyrInstance.elements ? plyrInstance.elements.container : container;
    setupPlayerOverlaysAndGestures(plyrContainer, video);
    plyrInstance.on('enterfullscreen', () => handleFullscreenChange());
    plyrInstance.on('exitfullscreen', () => handleFullscreenChange());
    if (savedTime > 15) video.currentTime = savedTime;
    video.addEventListener('ended', onEpisodeEnded);
  } else {
    // embed - unblocked iframe
    container.innerHTML = `<iframe src="${server.url}" class="video-iframe" frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen referrerpolicy="no-referrer"></iframe>`;
    setupPlayerOverlaysAndGestures(container, null);
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

// Global OTT Keyboard Shortcuts for Desktop / Laptop
document.addEventListener('keydown', (e) => {
  if (['input', 'textarea', 'select'].includes((document.activeElement.tagName || '').toLowerCase())) return;
  if (!document.getElementById('watchPlayerContainer')) return;
  const video = document.getElementById('hlsVideo') || document.querySelector('.watch-container video');

  if (e.key === 'l' || e.key === 'L') {
    e.preventDefault();
    toggleCinemaLights();
  } else if (e.key === 't' || e.key === 'T') {
    e.preventDefault();
    toggleTheaterMode();
  } else if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    toggleFsEpisodesDrawer();
  } else if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    openDownloadModal();
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    if (plyrInstance && plyrInstance.fullscreen) {
      plyrInstance.fullscreen.toggle();
    }
  } else if (e.key === 'm' || e.key === 'M') {
    if (video) {
      video.muted = !video.muted;
      showPlayerHud(video.muted ? 'Muted' : 'Unmuted', video.muted ? 'fa-volume-xmark' : 'fa-volume-high');
    }
  } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
    e.preventDefault();
    if (video) {
      if (video.paused) {
        if (plyrInstance && typeof plyrInstance.play === 'function') plyrInstance.play().catch(() => video.play());
        else video.play();
        showPlayerHud('Play ▶', 'fa-play');
      } else {
        if (plyrInstance && typeof plyrInstance.pause === 'function') plyrInstance.pause();
        else video.pause();
        showPlayerHud('Pause ⏸', 'fa-pause');
      }
    }
  } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
    if (video) {
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 10);
      showPlayerHud('-10s Rewind', 'fa-backward-step');
    }
  } else if (e.key === 'ArrowRight' || e.key === 'l') {
    if (video) {
      e.preventDefault();
      video.currentTime = Math.min(video.duration || 9999, video.currentTime + 10);
      showPlayerHud('+10s Forward', 'fa-forward-step');
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (video) {
      const cur = typeof video.volume === 'number' ? video.volume : 1.0;
      video.volume = Math.min(1, cur + 0.1);
      const pct = Math.round(video.volume * 100);
      showPlayerHud(`Volume ${pct}%`, 'fa-volume-high');
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (video) {
      const cur = typeof video.volume === 'number' ? video.volume : 1.0;
      video.volume = Math.max(0, cur - 0.1);
      const pct = Math.round(video.volume * 100);
      showPlayerHud(`Volume ${pct}%`, video.volume === 0 ? 'fa-volume-xmark' : 'fa-volume-low');
    }
  } else if (e.key === 'Escape') {
    closeFsEpisodesDrawer();
    const dlModal = document.getElementById('downloadModal');
    if (dlModal) dlModal.classList.remove('show');
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
    window.location.href = '/';
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

