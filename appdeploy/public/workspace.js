(() => {
  'use strict';
  const key = 'toon.shortlist.v1';
  const extras = [
    ['Volcano Racers', 'Night Shift'],
    ['Volcano Racers', 'Dead Air'],
    ['STARFALL', 'After the Sirens'],
    ['STARFALL', 'The Person in the File'],
  ];
  const books = sagas
    .flatMap(s =>
      s.arcs.map(title => ({
        world: s.world,
        saga: s.title,
        title,
        kind: 'Main arc',
      }))
    )
    .concat(
      extras.map(([world, title]) => ({
        world,
        saga: 'Proposed spin-off',
        title,
        kind: 'Spin-off',
      }))
    )
    .map((b, i) => ({
      ...b,
      id: 'book-' + i,
    }));
  let saved = new Set(),
    view = 'books',
    storageWorks = true,
    query = '',
    world = 'All';
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(value))
      saved = new Set(value.filter(x => books.some(b => b.id === x)));
  } catch {
    storageWorks = false;
  }
  const toolbar = document.createElement('div');
  toolbar.className = 'workspace-toolbar';
  toolbar.innerHTML =
    '<label>Find a book <input type="search" placeholder="Search titles or sagas…" aria-label="Search workspace books"></label><label>World <select aria-label="Filter workspace by world"><option>All</option><option>Volcano Racers</option><option>STARFALL</option></select></label>';
  document.querySelector('#workspace-status').before(toolbar);
  toolbar.querySelector('input').oninput = e => {
    query = e.target.value.toLowerCase().trim();
    render();
  };
  toolbar.querySelector('select').onchange = e => {
    world = e.target.value;
    render();
  };
  const content = document.querySelector('#workspace-content'),
    status = document.querySelector('#workspace-status');
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function card(b) {
    const a = el('article', 'book-card');
    a.append(
      el('span', 'eyebrow', b.world),
      el('h3', '', b.title),
      el('p', 'small', b.saga)
    );
    const leading = b.title === 'Ignition' || b.title === 'Begin';
    a.append(
      el(
        'span',
        'status',
        leading
          ? 'SCRIPT DRAFT · ART IN PROGRESS'
          : b.kind === 'Spin-off'
            ? 'PROPOSED SPIN-OFF'
            : 'IN DEVELOPMENT'
      )
    );
    a.append(
      el(
        'p',
        '',
        leading
          ? b.title === 'Ignition'
            ? '184-page script draft; 24-page illustrated opening chapter.'
            : '168-page script draft; 10 illustrated proof pages.'
          : 'Part of the graphic-novel development slate. Not a completed book for sale.'
      )
    );
    const button = el(
      'button',
      'chip',
      saved.has(b.id) ? 'Remove from shortlist' : 'Save to shortlist'
    );
    button.setAttribute('aria-pressed', String(saved.has(b.id)));
    button.setAttribute('aria-label', button.textContent + ' — ' + b.title);
    button.onclick = () => {
      saved.has(b.id) ? saved.delete(b.id) : saved.add(b.id);
      try {
        localStorage.setItem(key, JSON.stringify([...saved]));
      } catch {
        storageWorks = false;
      }
      render();
    };
    a.append(button);
    return a;
  }
  function row(title, body, state) {
    const a = el('article', 'book-card');
    a.append(
      el('span', 'status', state),
      el('h3', '', title),
      el('p', '', body)
    );
    return a;
  }
  function render() {
    content.replaceChildren();
    toolbar.hidden = view !== 'books' && view !== 'saved';
    document.querySelectorAll('[data-workspace]').forEach(b => {
      const on = b.dataset.workspace === view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const grid = el('div', 'workspace-grid');
    content.append(grid);
    if (view === 'books' || view === 'saved') {
      const items = books.filter(
        b =>
          (view !== 'saved' || saved.has(b.id)) &&
          (world === 'All' || world === b.world) &&
          [b.title, b.saga, b.world].join(' ').toLowerCase().includes(query)
      );
      items.forEach(b => grid.append(card(b)));
      status.textContent = `${items.length} books ${view === 'saved' ? 'in your shortlist' : 'on the development slate'} · ${saved.size} saved${storageWorks ? '' : ' · Browser storage unavailable; saves last only this visit'}`;
      if (!items.length)
        grid.append(
          el(
            'p',
            '',
            query || world !== 'All'
              ? 'No matching books. Clear your search or choose All worlds.'
              : view === 'saved'
                ? 'Your shortlist is empty. Save a book from the Book library to keep it here.'
                : 'No books available.'
          )
        );
    }
    if (view === 'apps') {
      status.textContent =
        'The hub and two comic apps are separate systems today.';
      for (const world of ['Volcano Racers', 'STARFALL']) {
        const a = row(
          world,
          'Reader proofs, download tools, collectibles, Art Studio and shop previews exist in the development app. A durable published app URL is not configured.',
          'DEVELOPMENT APP'
        );
        const list = el('ul', 'route-list');
        [
          ['/edition-b', 'Graphic-novel proof'],
          ['/downloads', 'Reading PDF & provisional print interior'],
          ['/collectibles', 'Free packs & browser-local collection'],
          ['/studio', 'Art briefs & storyboards'],
          ['/shop', 'Known-content product previews; checkout off'],
        ].forEach(([path, label]) =>
          list.append(el('li', '', `${label} · ${path}`))
        );
        a.append(
          list,
          el(
            'p',
            'small',
            'Launch unavailable until a stable deployment is verified. Expiring preview access tokens are never embedded here.'
          )
        );
        grid.append(a);
      }
      grid.append(
        row(
          'Shared account & owned library',
          'Not connected. Hub shortlist and each app’s browser-local data are separate. A shared sign-in, server-side entitlements and protected delivery must be verified before purchases or cross-app ownership.',
          'NOT CONNECTED'
        ),
        row(
          'Collectible art, not an investment',
          '40 illustrated cards currently available across the two prototypes. 500 planned card concepts are not 500 finished artworks. Packs use free prototype credits; no cash resale, cash-out or paid packs.',
          'PROTOTYPE'
        )
      );
    }
    if (view === 'production') {
      status.textContent =
        'Readiness is reported separately from creative ambition. No finished television season or retail-ready paperback is claimed.';
      [
        [
          'Graphic novels first',
          '31 planned books: 27 main-arc volumes and four proposed spin-offs. Ignition and Begin have complete first script drafts; illustrated production remains partial.',
          'WRITING + ART',
        ],
        [
          'Print & downloads',
          'Reading PDFs and provisional interiors work in the comic apps. Covers and wraps are design proofs. Final pagination, spine templates, resolution and vendor preflight remain before KDP or IngramSpark release.',
          'PREFLIGHT PENDING',
        ],
        [
          'Television & animation',
          'An Ember season outline, pilot screenplay draft and animatic script are in development. Produced episodes, animation, voices and distribution are not yet available.',
          'DEVELOPMENT',
        ],
        [
          'Graphic novels & art bundles',
          'Sell known, clearly described contents only when assets and rights are ready. Shop previews are not offers to charge. Payment processing, protected fulfillment, policies and cost validation remain launch gates.',
          'CHECKOUT DISABLED',
        ],
        [
          'Games & collecting',
          'Free prototype packs, a collection binder, simulated exchanges and an optional duel support exploration. No real peer trading or shared cross-app inventory yet.',
          'PROTOTYPE',
        ],
        [
          'Art Studio',
          'Create briefs, reference boards and storyboards in the app prototypes. Live paid image generation remains disabled; creation must not imply ownership of unavailable artwork.',
          'TOOLS PROTOTYPE',
        ],
      ].forEach(x => grid.append(row(...x)));
    }
  }
  document.querySelectorAll('[data-workspace]').forEach(
    b =>
      (b.onclick = () => {
        view = b.dataset.workspace;
        render();
      })
  );
  render();
})();
