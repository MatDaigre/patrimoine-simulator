(() => {
  const MOBILE_MAX = 720;
  const media = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
  if (!media.matches) return;

  const ready = () => {
    if (document.body.dataset.mobileNavReady === '1') return;

    const hero = document.querySelector('.hero');
    const stats = document.querySelector('.stats-grid');
    const main = document.querySelector('.main-column');
    const side = document.querySelector('.side-column');
    const topbar = document.querySelector('.topbar');
    const topActions = document.querySelector('.top-actions');

    if (!hero || !stats || !main || !side || !topbar) return;

    document.body.dataset.mobileNavReady = '1';
    document.body.classList.add('mobile-app-ready');

    const mainChildren = Array.from(main.children);
    const sideChildren = Array.from(side.children);

    const budget = main.querySelector('.budget-card');
    const invest = main.querySelector('.invest-card');
    const projectsGroup = main.querySelector('.two-cards');
    const loan = main.querySelector('.loan-card');
    const realEstate = main.querySelector('.realestate-card');

    const assetCard = sideChildren.find((node) => node.querySelector?.('.asset-performance'));
    const historyCard = sideChildren.find((node) => node.classList?.contains('history-card'));
    const debtCard = sideChildren.find((node) => node.classList?.contains('debt-card'));
    const journeyCard = sideChildren.find((node) => node.classList?.contains('journey-card'));
    const healthCard = sideChildren.find((node) => node.classList?.contains('health-card'));
    const recapCard = sideChildren.find((node) => node.classList?.contains('recap-card'));
    const eventCard = sideChildren.find((node) => node.classList?.contains('event-info-card'));
    const disclaimerCard = sideChildren.find((node) => node.classList?.contains('disclaimer'));
    const goalsCard = sideChildren.find((node) => {
      const title = node.querySelector?.('h3')?.textContent?.trim();
      return title === 'Objectifs long terme';
    });

    const views = {
      home: [hero, stats, budget, healthCard, journeyCard].filter(Boolean),
      invest: [invest, assetCard].filter(Boolean),
      projects: [projectsGroup, loan, realEstate].filter(Boolean),
      bilan: [recapCard, goalsCard, debtCard, historyCard, eventCard, disclaimerCard].filter(Boolean),
    };

    const controlled = new Set([
      hero,
      stats,
      ...mainChildren,
      ...sideChildren,
    ].filter(Boolean));

    controlled.forEach((node) => {
      node.dataset.mobileManaged = '1';
    });

    const titleBar = document.createElement('div');
    titleBar.className = 'mobile-view-heading';
    titleBar.innerHTML = '<span class="mobile-view-kicker">Navigation</span><strong id="mobileViewTitle">Accueil</strong>';
    const layout = document.querySelector('.layout');
    layout?.parentNode?.insertBefore(titleBar, layout);

    if (topActions) {
      const menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = 'mobile-menu-toggle';
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.innerHTML = '<span aria-hidden="true">☰</span><span>Menu</span>';
      topbar.insertBefore(menuButton, topActions);

      menuButton.addEventListener('click', () => {
        const open = topActions.classList.toggle('mobile-actions-open');
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.classList.toggle('is-open', open);
      });

      topActions.addEventListener('click', (event) => {
        if (event.target.closest('button')) {
          topActions.classList.remove('mobile-actions-open');
          menuButton.setAttribute('aria-expanded', 'false');
          menuButton.classList.remove('is-open');
        }
      });
    }

    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Navigation principale');

    const items = [
      ['home', '⌂', 'Accueil'],
      ['invest', '↗', 'Investir'],
      ['projects', '▣', 'Projets'],
      ['bilan', '≡', 'Bilan'],
    ];

    items.forEach(([key, icon, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mobileTab = key;
      button.innerHTML = `<span class="mobile-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
      button.addEventListener('click', () => activate(key, true));
      nav.appendChild(button);
    });
    document.body.appendChild(nav);

    const heading = titleBar.querySelector('#mobileViewTitle');
    const labels = { home: 'Accueil', invest: 'Investir', projects: 'Projets', bilan: 'Bilan' };

    function activate(key, shouldScroll = false) {
      const active = views[key] ? key : 'home';
      const visible = new Set(views[active]);

      controlled.forEach((node) => {
        node.hidden = !visible.has(node);
      });

      main.hidden = !mainChildren.some((node) => !node.hidden);
      side.hidden = !sideChildren.some((node) => !node.hidden);

      nav.querySelectorAll('[data-mobile-tab]').forEach((button) => {
        const selected = button.dataset.mobileTab === active;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
      });

      document.body.dataset.mobileView = active;
      if (heading) heading.textContent = labels[active];
      try { sessionStorage.setItem('patrimoineMobileView', active); } catch {}

      if (topActions) topActions.classList.remove('mobile-actions-open');
      document.querySelector('.mobile-menu-toggle')?.setAttribute('aria-expanded', 'false');

      if (shouldScroll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    let initial = 'home';
    try {
      const saved = sessionStorage.getItem('patrimoineMobileView');
      if (saved && views[saved]) initial = saved;
    } catch {}
    activate(initial, false);

    media.addEventListener?.('change', (event) => {
      if (!event.matches) window.location.reload();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();
