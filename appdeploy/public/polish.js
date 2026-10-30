(() => {
  'use strict';
  const art = document.querySelector('.hero-art');
  const worlds = {
    volcano: {
      title: 'VOLCANO RACERS',
      src: 'https://raw.githubusercontent.com/harrisonjrubin7-cmyk/toon-platform/eaaf9264549f3ea0887b427bc1d43c9965ab1932/dist/assets/volcano.jpg',
      href: '#volcano',
      alt: 'Volcano Racers Ignition cover: a racer overlooking a lava-lit city',
    },
    starfall: {
      title: 'STARFALL',
      src: 'https://raw.githubusercontent.com/harrisonjrubin7-cmyk/toon-platform/eaaf9264549f3ea0887b427bc1d43c9965ab1932/dist/assets/starfall.jpg',
      href: '#starfall',
      alt: 'STARFALL Begin cover: a rain-soaked basketball court beneath a streak of light',
    },
  };
  document.querySelectorAll('[data-spotlight]').forEach(button =>
    button.addEventListener('click', () => {
      const world = worlds[button.dataset.spotlight];
      art.href = world.href;
      art.setAttribute('aria-label', 'Explore ' + world.title);
      const img = art.querySelector('img');
      img.src = world.src;
      img.alt = world.alt;
      art.querySelector('strong').textContent = world.title;
      document.querySelectorAll('[data-spotlight]').forEach(b => {
        const active = b === button;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    })
  );
  if ('IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('nav a')];
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const link = links.find(a => a.hash === '#' + entry.target.id);
          if (link) {
            links.forEach(a => a.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'location');
          }
        }
      },
      {
        rootMargin: '-15% 0px -65% 0px',
        threshold: 0,
      }
    );
    links.forEach(a => {
      const section = document.querySelector(a.hash);
      if (section) observer.observe(section);
    });
  }
})();
