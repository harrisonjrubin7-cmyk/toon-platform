(() => {
  'use strict';
  const dossiers = {
    volcano: {
      name: 'Volcano Racers',
      kicker: 'CINDER ISLE / THE EMBER HEART',
      intro: 'A stolen heart. Seven pieces. A home running out of warmth.',
      body: 'The rally has a destination beyond the finish line: bringing fire home. Cinder Isle’s cooling landscape and Ember’s fading strength make every mile personal.',
      cards: [
        [
          'THE CREW',
          'Six names at the starting line',
          'Blaze, Pip, Duke Whiskers, Jackrabbit Joe, Captain Quackers and Ember form the central ensemble. Their shared journey holds the story together.',
        ],
        [
          'THE STAKES',
          'Home is on the clock',
          'The Ember Heart has been stolen and shattered into seven pieces. The crew enters a global rally while the island cools.',
        ],
        [
          'THE HUMAN THREAD',
          'Choosing one another',
          'Injury, debt and betrayal put pressure on a story of found family. The relationships carry consequences beyond the races.',
        ],
        [
          'BEYOND THE OPENING',
          'Three saga slates',
          'The Ember Heart Saga, The Apex Saga and The Hive Saga extend the catalog. Each has its own edition and readiness notes.',
        ],
      ],
    },
    starfall: {
      name: 'STARFALL',
      kicker: 'THE EIGHT / POWER AND BELONGING',
      intro: 'Extraordinary abilities. Very human questions.',
      body: 'Eight teenagers face a world eager to define them. Friendship, family and the right to decide for themselves sit at the center of the story.',
      cards: [
        [
          'THE ENSEMBLE',
          'Jordan, Darius and the Eight',
          'The central group navigates friendship and family alongside extraordinary change. Begin introduces the world before the stakes expand.',
        ],
        [
          'THE PRESSURE',
          'Who gets to decide?',
          'Surveillance and consent shape a story in which being seen is not always the same as being understood.',
        ],
        [
          'THE HUMAN THREAD',
          'Solidarity has a cost',
          'The story asks what standing together means when people do not share the same protection. Belonging is part of the stakes.',
        ],
        [
          'BEYOND THE OPENING',
          'A wider story ahead',
          'The original STARFALL saga is followed in the current catalog by Echoes and Harrows. Sequel source material is partial; development continues.',
        ],
      ],
    },
  };
  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function show(key) {
    const d = dossiers[key];
    const wrap = node('div', 'dossier');
    const intro = node('div', 'dossier-intro');
    intro.append(
      node('span', 'eyebrow', d.kicker),
      node('h3', '', d.intro),
      node('p', '', d.body)
    );
    const grid = node('div', 'dossier-grid');
    for (const [label, title, body] of d.cards) {
      const card = node('article', 'dossier-card');
      card.append(
        node('span', 'eyebrow', label),
        node('h4', '', title),
        node('p', '', body)
      );
      grid.append(card);
    }
    wrap.append(intro, grid);
    document.querySelector('#atlas-content').replaceChildren(wrap);
    document.querySelectorAll('[data-atlas]').forEach(b => {
      const active = b.dataset.atlas === key;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }
  document
    .querySelectorAll('[data-atlas]')
    .forEach(b => b.addEventListener('click', () => show(b.dataset.atlas)));
  show('volcano');
})();
