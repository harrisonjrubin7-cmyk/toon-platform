(() => {
  const KEY = 'vr.ageOk';
  try { if (localStorage.getItem(KEY) === '1') return; } catch { /* storage blocked: ask every visit */ }
  const d = document.createElement('dialog');
  d.className = 'vr-age-gate';
  d.innerHTML = `<h2>Volcano Racers is for adults</h2>
    <p>These games come from an 18+ comic. Are you 18 or older?</p>
    <button class="tn-btn" value="yes" autofocus>I'm 18 or older</button>
    <button class="tn-btn" value="no">Leave</button>`;
  d.addEventListener('cancel', e => e.preventDefault());
  d.addEventListener('click', e => {
    if (e.target.value === 'yes') {
      try { localStorage.setItem(KEY, '1'); } catch { }
      d.close(); d.remove();
    }
    if (e.target.value === 'no') location.replace('about:blank');
  });
  document.body.append(d); d.showModal();
})();
