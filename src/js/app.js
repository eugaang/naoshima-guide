'use strict';

// ============================================================
// 나오시마 비전트립 가이드 — app.js
// JSON 데이터를 DOM에 렌더링하는 단일 스크립트
// ============================================================

// --------------- DOM References ---------------
const siteTitle    = document.getElementById('site-title');
const siteSubtitle = document.getElementById('site-subtitle');
const navTabs      = document.getElementById('nav-tabs');
const contentMain  = document.getElementById('content');
const footerText   = document.getElementById('footer-text');

// --------------- State ---------------
let sectionsData    = null;
let artistsData     = null;
let arthousesData   = null;
let currentView     = 'sections';
let savedScrollY    = 0; // 상세 뷰 진입 전 스크롤 위치 저장

// --------------- Utility ---------------

/** Show a loading indicator inside the main content area */
const showLoading = () => {
  contentMain.innerHTML = `
    <div class="loading" role="status" aria-label="로딩 중">
      <div class="loading__spinner"></div>
      <p class="loading__text">콘텐츠를 불러오는 중입니다...</p>
    </div>`;
};

/** Show a user-friendly error message in Korean */
const showError = (message) => {
  contentMain.innerHTML = `
    <div class="error-message" role="alert">
      <p class="error-message__icon">⚠️</p>
      <p class="error-message__text">${message}</p>
      <button class="error-message__retry" onclick="location.reload()">다시 시도</button>
    </div>`;
};

/** Cache-busting version (increment to force reload of images) */
const ASSET_VERSION = '36';

/** Render image figure if subsection has an image */
const renderImage = (sub) => {
  if (!sub.image) return '';
  const src = `${sub.image}?v=${ASSET_VERSION}`;
  return `
    <figure class="subsection__figure">
      <img class="subsection__image" src="${src}" alt="${sub.imageAlt || ''}" loading="lazy">
    </figure>`;
};

/** Extract initials for artist avatar placeholder */
const getInitials = (name) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return parts[0][0] + parts[1][0];
  }
  return name.slice(0, 2);
};

/** Handle image load error — show colored placeholder with initials */
const handleImageError = (img, name) => {
  const initials = getInitials(name);
  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = initials;
  img.parentNode.replaceChild(placeholder, img);
};

// --------------- Data Loading ---------------

const loadData = async () => {
  showLoading();

  try {
    const [sectionsRes, artistsRes, arthousesRes] = await Promise.all([
      fetch('data/sections.json'),
      fetch('data/artists.json'),
      fetch('data/arthouses.json')
    ]);

    if (!sectionsRes.ok || !artistsRes.ok || !arthousesRes.ok) {
      throw new Error('데이터를 불러올 수 없습니다.');
    }

    const sectionsJSON  = await sectionsRes.json();
    const artistsJSON   = await artistsRes.json();
    const arthousesJSON = await arthousesRes.json();

    sectionsData  = sectionsJSON;
    artistsData   = artistsJSON.artists;
    arthousesData = arthousesJSON.arthouses;
    arthousesData.__info = arthousesJSON.info || {};

    return true;
  } catch (err) {
    console.error('데이터 로딩 실패:', err);
    showError('데이터를 불러오는 데 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    return false;
  }
};

// --------------- Rendering: Header / Footer ---------------

const renderHeader = () => {
  const { title, subtitle, hero } = sectionsData.site;
  siteTitle.textContent    = title;
  siteSubtitle.textContent = subtitle;
  document.title           = title;
  document.querySelector('meta[name="description"]').setAttribute('content', subtitle);

  // Add hero image if specified
  if (hero) {
    const header = document.getElementById('site-header');
    header.style.backgroundImage = `url('${hero}')`;
    header.classList.add('site-header--hero');
  }
};

const renderFooter = () => {
  footerText.textContent = `${sectionsData.site.title} — 교회 비전트립팀`;
};

// --------------- Rendering: Navigation ---------------

const renderNav = () => {
  const tabs = sectionsData.sections.map((section) => `
    <li class="nav__item" role="tab"
        id="tab-${section.id}"
        aria-controls="section-${section.id}"
        aria-selected="false"
        tabindex="0"
        data-section="${section.id}">
      <span class="nav__icon" aria-hidden="true">${section.icon}</span>
      <span class="nav__label">${section.title}</span>
    </li>`
  ).join('');

  navTabs.innerHTML = tabs;
};

// --------------- Rendering: Subsection Types ---------------

/**
 * Render a "text" subsection — article with title and HTML content.
 */
const renderTextSubsection = (sub) => `
  <article class="subsection subsection--text">
    <h3 class="subsection__title">${sub.title}</h3>
    ${renderImage(sub)}
    <div class="subsection__content">${sub.content}</div>
  </article>`;

/**
 * Render a "timeline" subsection.
 * Parses <strong>year</strong> — description patterns.
 */
const renderTimelineSubsection = (sub) => {
  // Split content by <br><br> to get individual entries
  const entries = sub.content.split('<br><br>').filter((e) => e.trim());

  const timelineItems = entries.map((entry) => {
    // Extract year from <strong>year</strong>
    const yearMatch = entry.match(/<strong>(\d{4}(?:년)?)<\/strong>/);
    const year = yearMatch ? yearMatch[1] : '';
    // Get description: everything after the — (em dash)
    const descParts = entry.split('—');
    const description = descParts.length > 1
      ? descParts.slice(1).join('—').trim()
      : entry.replace(/<strong>[^<]*<\/strong>\s*/, '').trim();

    return `
      <li class="timeline__item">
        <span class="timeline__year">${year}</span>
        <div class="timeline__content">${description}</div>
      </li>`;
  }).join('');

  return `
    <article class="subsection subsection--timeline">
      <h3 class="subsection__title">${sub.title}</h3>
      ${renderImage(sub)}
      <ol class="timeline">${timelineItems}</ol>
    </article>`;
};

/**
 * Render a "map-info" subsection — similar to text but with map-info styling class.
 */
const renderMapInfoSubsection = (sub) => `
  <article class="subsection subsection--map-info">
    <h3 class="subsection__title">${sub.title}</h3>
    ${renderImage(sub)}
    <div class="subsection__content">${sub.content}</div>
  </article>`;

/**
 * Render a single artist card — compact with photo, clickable to detail view.
 */
const renderArtistCard = (artist) => {
  const initials = getInitials(artist.name);
  const portraitSrc = `images/artists/${artist.id}-portrait.jpg`;

  return `
    <article class="artist-card" data-artist-id="${artist.id}"
             role="link" tabindex="0"
             aria-label="${artist.name} 상세보기">
      <div class="artist-card__photo-wrap">
        <img class="artist-card__photo"
             src="${portraitSrc}"
             alt="${artist.name} 초상"
             loading="lazy"
             onerror="this.onerror=null;this.parentNode.innerHTML='<div class=\\'image-placeholder\\' aria-hidden=\\'true\\'>${initials}</div>';">
      </div>
      <div class="artist-card__body">
        <h4 class="artist-card__name">${artist.name}</h4>
        <p class="artist-card__name-en">${artist.nameEn}</p>
        <p class="artist-card__summary">${artist.summary}</p>
      </div>
    </article>`;
};

/**
 * Render the "cards" subsection — intro text + artist cards.
 */
const renderCardsSubsection = (sub) => {
  const cardsHTML = artistsData.map(renderArtistCard).join('');

  return `
    <article class="subsection subsection--cards">
      <h3 class="subsection__title">${sub.title}</h3>
      <div class="subsection__content">
        <p>${sub.content}</p>
      </div>
      <div class="artist-cards">${cardsHTML}</div>
    </article>`;
};

/**
 * Dispatch rendering to the correct subsection renderer.
 */
/**
 * Render an arthouse card (compact, clickable).
 */
const renderArthouseCard = (ah) => `
  <article class="artist-card" data-arthouse-id="${ah.id}"
           role="link" tabindex="0"
           aria-label="${ah.name} 상세보기">
    <div class="artist-card__photo-wrap">
      <img class="artist-card__photo"
           src="${ah.photo}?v=${ASSET_VERSION}"
           alt="${ah.name}"
           loading="lazy"
           onerror="this.onerror=null;this.parentNode.innerHTML='<div class=\\'image-placeholder\\' aria-hidden=\\'true\\'>${ah.name.slice(0,2)}</div>';">
    </div>
    <div class="artist-card__body">
      <h4 class="artist-card__name">${ah.name} <span style="font-weight:400;color:var(--color-text-muted);font-size:14px">${ah.nameJp}</span></h4>
      <p class="artist-card__name-en">${ah.artist}</p>
      <p class="artist-card__summary">${ah.summary}</p>
    </div>
  </article>`;

/**
 * Render the "arthouse-cards" subsection.
 */
const renderArthouseCardsSubsection = (sub) => {
  const cardsHTML = arthousesData.map(renderArthouseCard).join('');
  return `
    <article class="subsection subsection--cards">
      <h3 class="subsection__title">${sub.title}</h3>
      ${renderImage(sub)}
      <div class="subsection__content"><p>${sub.content}</p></div>
      <div class="artist-cards">${cardsHTML}</div>
    </article>`;
};

/**
 * Render arthouse detail view.
 */
const renderArthouseDetail = (arthouseId) => {
  const ah = arthousesData.find((a) => a.id === arthouseId);
  if (!ah) { showError('아트하우스 정보를 찾을 수 없습니다.'); return; }

  currentView = 'arthouse-detail';
  const info = arthousesData.__info || {};

  contentMain.innerHTML = `
    <div class="artist-detail">
      <nav class="artist-detail__nav">
        <button class="artist-detail__back" data-back-to="artists-and-works" aria-label="목록으로 돌아가기">
          ← 목록으로
        </button>
      </nav>

      <div class="artist-detail__hero" style="border-radius:var(--radius-lg);overflow:hidden">
        <div class="artist-detail__hero-photo" style="border-radius:12px;width:180px;height:180px">
          <img class="artist-detail__portrait" src="${ah.photo}?v=${ASSET_VERSION}" alt="${ah.name}"
               style="border-radius:12px"
               onerror="this.onerror=null;handleImageError(this,'${ah.name}');">
        </div>
        <div class="artist-detail__hero-info">
          <h2 class="artist-detail__name">${ah.name}</h2>
          <p class="artist-detail__name-en">${ah.nameJp} ${ah.nameEn}</p>
          <p class="artist-detail__meta">${ah.artist}</p>
          <p class="artist-detail__meta" style="margin-top:4px"><strong>${ah.work}</strong> · ${ah.year}</p>
          ${ah.hours ? `<p class="artist-detail__meta" style="margin-top:8px;font-size:13px;opacity:0.7">🕐 ${ah.hours}</p>` : ''}
        </div>
      </div>

      <section class="artist-detail__section">
        <h3 class="artist-detail__section-title">작품 소개</h3>
        <div class="artist-detail__text">${ah.description}</div>
      </section>

      ${ah.gallery && ah.gallery.length > 0 ? `
      <section class="artist-detail__section">
        <h3 class="artist-detail__section-title">📷 갤러리</h3>
        <div class="arthouse-gallery">
          ${ah.gallery.map((img, i) => `
            <div class="arthouse-gallery__item">
              <img src="${img}?v=${ASSET_VERSION}" alt="${ah.name} 사진 ${i + 1}" loading="lazy"
                   class="arthouse-gallery__img"
                   onclick="this.classList.toggle('arthouse-gallery__img--expanded')">
            </div>`).join('')}
        </div>
      </section>` : ''}

      ${ah.visitTip ? `
      <section class="artist-detail__section" style="background:var(--color-pink, #FADCE0);border:none">
        <h3 class="artist-detail__section-title" style="color:var(--color-accent, #E8637A)">💡 관람 팁</h3>
        <p class="artist-detail__text">${ah.visitTip}</p>
      </section>` : ''}

      <nav class="artist-detail__nav" style="margin-top:var(--space-md)">
        <button class="artist-detail__back" type="button" aria-label="목록으로 돌아가기">
          ← 목록으로
        </button>
      </nav>
    </div>`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderSubsection = (sub) => {
  switch (sub.type) {
    case 'text':            return renderTextSubsection(sub);
    case 'timeline':        return renderTimelineSubsection(sub);
    case 'cards':           return renderCardsSubsection(sub);
    case 'arthouse-cards':  return renderArthouseCardsSubsection(sub);
    case 'map-info':        return renderMapInfoSubsection(sub);
    default:                return renderTextSubsection(sub);
  }
};

// --------------- Rendering: Sections (Main List View) ---------------

const renderSections = () => {
  // Restore section skeleton (loading replaced the content)
  contentMain.innerHTML = sectionsData.sections.map((section) => `
    <section id="section-${section.id}"
             class="content-section"
             role="tabpanel"
             aria-labelledby="tab-${section.id}"
             hidden>
      <h2 class="section__title">
        <span class="section__icon" aria-hidden="true">${section.icon}</span>
        ${section.title}
      </h2>
      <div class="section__subsections">
        ${section.subsections.map(renderSubsection).join('')}
      </div>
    </section>`
  ).join('');
};

// --------------- Rendering: Artist Detail View ---------------

/**
 * Render the full artist detail view.
 */
const renderArtistDetail = (artistId) => {
  const artist = artistsData.find((a) => a.id === artistId);
  if (!artist) {
    showError('작가 정보를 찾을 수 없습니다.');
    return;
  }

  const initials = getInitials(artist.name);
  const portraitSrc = `images/artists/${artist.id}-portrait.jpg`;

  // Render naoshima works cards
  const worksHTML = artist.naoshimaWorks.map((work, index) => {
    const workImgSrc = index === 0
      ? `images/artists/${artist.id}-work.jpg?v=${ASSET_VERSION}`
      : `images/artists/${artist.id}-work-${index + 1}.jpg?v=${ASSET_VERSION}`;
    const workInitials = work.title.slice(0, 2);

    return `
      <article class="artist-detail__work-card">
        <div class="artist-detail__work-image-wrap">
          <img class="artist-detail__work-image"
               src="${workImgSrc}"
               alt="${work.title}"
               loading="lazy"
               onerror="this.onerror=null;this.parentNode.innerHTML='<div class=\\'image-placeholder image-placeholder--work\\' aria-hidden=\\'true\\'>${workInitials}</div>';">
        </div>
        <div class="artist-detail__work-body">
          <h4 class="artist-detail__work-title">${work.title}</h4>
          <p class="artist-detail__work-meta">${work.year} · ${work.location}</p>
          <p class="artist-detail__work-desc">${work.description}</p>
        </div>
      </article>`;
  }).join('');

  // Render korea works list
  const koreaHTML = artist.koreaWorks.map((work) => `
    <li class="artist-detail__korea-item">
      <strong>${work.title}</strong>
      <span class="artist-detail__korea-venue">${work.venue} (${work.year})</span>
      ${work.note ? `<p class="artist-detail__korea-note">${work.note}</p>` : ''}
    </li>`
  ).join('');

  contentMain.innerHTML = `
    <div class="artist-detail" role="article" aria-label="${artist.name} 상세 정보">
      <nav class="artist-detail__nav" aria-label="작가 목록으로 돌아가기">
        <button class="artist-detail__back" type="button"
                aria-label="목록으로 돌아가기">
          ← 목록으로
        </button>
      </nav>

      <header class="artist-detail__hero">
        <div class="artist-detail__hero-photo">
          <img src="${portraitSrc}"
               alt="${artist.name} 초상"
               class="artist-detail__portrait"
               onerror="this.onerror=null;this.parentNode.innerHTML='<div class=\\'image-placeholder image-placeholder--hero\\' aria-hidden=\\'true\\'>${initials}</div>';">
        </div>
        <div class="artist-detail__hero-info">
          <h2 class="artist-detail__name">${artist.name}</h2>
          <p class="artist-detail__name-en">${artist.nameEn}</p>
          <p class="artist-detail__meta">${artist.born}~ · ${artist.nationality}</p>
        </div>
      </header>

      <section class="artist-detail__section" aria-labelledby="why-naoshima-${artist.id}">
        <h3 class="artist-detail__section-title" id="why-naoshima-${artist.id}">왜 나오시마에?</h3>
        <p class="artist-detail__text">${artist.whyNaoshima}</p>
      </section>

      <section class="artist-detail__section" aria-labelledby="works-${artist.id}">
        <h3 class="artist-detail__section-title" id="works-${artist.id}">나오시마 작품</h3>
        <div class="artist-detail__works">${worksHTML}</div>
      </section>

      <section class="artist-detail__section" aria-labelledby="korea-${artist.id}">
        <h3 class="artist-detail__section-title" id="korea-${artist.id}">한국에서 만나기</h3>
        <ul class="artist-detail__korea-list">${koreaHTML}</ul>
      </section>

      <nav class="artist-detail__nav" style="margin-top:var(--space-md)">
        <button class="artist-detail__back" type="button" aria-label="목록으로 돌아가기">
          ← 목록으로
        </button>
      </nav>
    </div>`;

  currentView = 'artist-detail';
};

// --------------- Navigation Logic ---------------

/**
 * Activate a section by its id. Deactivates all others.
 */
const activateSection = (sectionId) => {
  // Update nav tabs
  const tabs = navTabs.querySelectorAll('.nav__item');
  tabs.forEach((tab) => {
    const isActive = tab.dataset.section === sectionId;
    tab.classList.toggle('nav__item--active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update content sections
  const sections = contentMain.querySelectorAll('.content-section');
  sections.forEach((section) => {
    const id = section.id.replace('section-', '');
    const isActive = id === sectionId;
    section.classList.toggle('content-section--active', isActive);
    if (isActive) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', '');
    }
  });

  currentView = 'sections';
};

/**
 * Show the sections list view (re-render if needed after detail view).
 */
const showSectionsView = (sectionId) => {
  // If we're currently showing a detail view, re-render sections
  if (currentView === 'artist-detail' || currentView === 'arthouse-detail') {
    renderSections();
    currentView = 'sections';
  }
  activateSection(sectionId);
};

/**
 * Navigate to artist detail view.
 */
const navigateToArtist = (artistId) => {
  savedScrollY = window.scrollY;
  renderArtistDetail(artistId);
  history.pushState({ view: 'artist', id: artistId }, '', `#artist/${artistId}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Navigate to arthouse detail view.
 */
const navigateToArthouse = (arthouseId) => {
  savedScrollY = window.scrollY;
  renderArthouseDetail(arthouseId);
  history.pushState({ view: 'arthouse', id: arthouseId }, '', `#arthouse/${arthouseId}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Navigate back to sections view from artist detail.
 */
const navigateToSections = (sectionId) => {
  const targetSection = sectionId || getLastActiveSectionId() || sectionsData.sections[0].id;
  showSectionsView(targetSection);
  history.pushState({ view: 'sections', id: targetSection }, '', `#${targetSection}`);
  // DOM 렌더링 완료 후 저장된 스크롤 위치로 복원
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    });
  });
};

/** Remember which section the artists tab belongs to */
const getArtistsSectionId = () => {
  // Find the section that contains the 'cards' subsection type
  const section = sectionsData.sections.find((s) =>
    s.subsections.some((sub) => sub.type === 'cards')
  );
  return section ? section.id : sectionsData.sections[0].id;
};

/** Get the last active section id from nav tabs */
const getLastActiveSectionId = () => {
  const activeTab = navTabs.querySelector('.nav__item--active');
  return activeTab ? activeTab.dataset.section : null;
};

// --------------- Routing ---------------

/**
 * Parse hash and route to the appropriate view.
 */
const parseHashAndRoute = () => {
  const hash = window.location.hash.replace('#', '');

  // Artist detail: #artist/{id}
  const artistMatch = hash.match(/^artist\/(.+)$/);
  if (artistMatch) {
    const artistId = artistMatch[1];
    if (artistsData && artistsData.find((a) => a.id === artistId)) {
      renderArtistDetail(artistId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }

  // Arthouse detail: #arthouse/{id}
  const arthouseMatch = hash.match(/^arthouse\/(.+)$/);
  if (arthouseMatch) {
    const arthouseId = arthouseMatch[1];
    if (arthousesData && arthousesData.find((a) => a.id === arthouseId)) {
      renderArthouseDetail(arthouseId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }

  // Section view: #{section-id}
  const sectionId = hash && sectionsData.sections.some((s) => s.id === hash)
    ? hash
    : sectionsData.sections[0].id;

  showSectionsView(sectionId);
  // popstate로 돌아올 때도 스크롤 복원
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    });
  });
};

// --------------- Event Delegation ---------------

const setupEventListeners = () => {
  // Nav tab clicks — event delegation on navTabs
  navTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav__item');
    if (!tab) return;
    const sectionId = tab.dataset.section;
    showSectionsView(sectionId);
    history.pushState({ view: 'sections', id: sectionId }, '', `#${sectionId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Nav tab keyboard accessibility (Enter / Space)
  navTabs.addEventListener('keydown', (e) => {
    const tab = e.target.closest('.nav__item');
    if (!tab) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const sectionId = tab.dataset.section;
      showSectionsView(sectionId);
      history.pushState({ view: 'sections', id: sectionId }, '', `#${sectionId}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Artist card click — navigate to detail view (event delegation on contentMain)
  contentMain.addEventListener('click', (e) => {
    // Back button in detail view
    const backBtn = e.target.closest('.artist-detail__back');
    if (backBtn) {
      const sectionId = getArtistsSectionId();
      navigateToSections(sectionId);
      return;
    }

    // Artist card click
    const card = e.target.closest('.artist-card[data-artist-id]');
    if (card) {
      navigateToArtist(card.dataset.artistId);
      return;
    }

    // Arthouse card click
    const ahCard = e.target.closest('.artist-card[data-arthouse-id]');
    if (ahCard) {
      navigateToArthouse(ahCard.dataset.arthouseId);
      return;
    }

    // Zoomable image click (chichu gallery etc.)
    const zoomImg = e.target.closest('.zoomable-img');
    if (zoomImg) {
      zoomImg.classList.toggle('zoomable-img--expanded');
      return;
    }
  });

  // Artist card keyboard accessibility (Enter / Space)
  contentMain.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    // Back button
    const backBtn = e.target.closest('.artist-detail__back');
    if (backBtn) {
      e.preventDefault();
      const sectionId = getArtistsSectionId();
      navigateToSections(sectionId);
      return;
    }

    // Artist card
    const card = e.target.closest('.artist-card[data-artist-id]');
    if (card) {
      e.preventDefault();
      navigateToArtist(card.dataset.artistId);
      return;
    }

    // Arthouse card
    const ahCard = e.target.closest('.artist-card[data-arthouse-id]');
    if (ahCard) {
      e.preventDefault();
      navigateToArthouse(ahCard.dataset.arthouseId);
      return;
    }
  });

  // Handle browser back/forward (popstate)
  window.addEventListener('popstate', () => {
    parseHashAndRoute();
  });
};

// --------------- Initialization ---------------

const init = async () => {
  const success = await loadData();
  if (!success) return;

  renderHeader();
  renderFooter();
  renderNav();
  renderSections();
  setupEventListeners();

  // Route based on initial hash
  parseHashAndRoute();
};

// Start the application
document.addEventListener('DOMContentLoaded', init);
