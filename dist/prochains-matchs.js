(() => {
  const crests = { 'FC Courfaivre': 'blasons/10110.jpg', 'FC Courtemaîche': 'blasons/10114.jpg', 'FC Haute-Sorne': 'blasons/10163.jpg' };
  const dateFormat = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
  const stampFormat = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Zurich' });
  const node = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
  function club(name) {
    const el = node('div', 'match-club');
    if (crests[name]) {
      const img = node('img', ''); img.src = crests[name]; img.alt = ''; img.width = 80; img.height = 80; el.append(img);
    } else {
      const initials = name.replace(/^FC\s+/i, '').split(/[\s-]+/).map(x => x[0]).slice(0, 3).join('');
      const badge = node('span', 'club-monogram', initials); badge.setAttribute('aria-hidden', 'true'); el.append(badge);
    }
    el.append(node('span', '', name)); return el;
  }
  function render(card, data) {
    const content = card.querySelector('.upcoming-content'); content.replaceChildren();
    const match = data.matches[0];
    if (match) {
      const date = node('time', 'fixture-date', dateFormat.format(new Date(match.date + 'T12:00:00+01:00'))); date.dateTime = match.date; content.append(date);
      const scoreboard = node('div', 'match-scoreboard');
      const versus = node('div', 'fixture-versus'); versus.append(node('strong', '', 'VS'), node('span', '', match.time || 'Horaire à confirmer'));
      scoreboard.append(club(match.home), versus, club(match.away)); content.append(scoreboard);
      content.append(node('p', 'fixture-location', /Courfaivre/i.test(match.home) ? 'À domicile' : 'À l’extérieur'));
    } else content.append(node('p', 'fixture-empty', 'Aucun prochain match annoncé par l’ASF.'));
    const a = card.querySelector('.fixture-source'); a.href = data.source;
    card.querySelector('.fixture-freshness').textContent = (data.stale ? 'Copie ASF du ' : 'Source ASF · Actualisé le ') + stampFormat.format(new Date(data.fetchedAt)) + (data.stale ? ' · Actualisation momentanément indisponible.' : '');
  }
  for (const card of document.querySelectorAll('[data-upcoming]')) {
    fetch('/api/prochains-matchs/' + card.dataset.upcoming, { signal: AbortSignal.timeout(12000) })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!Array.isArray(data.matches)) throw new Error(); render(card, data); })
      .catch(() => { card.querySelector('.fixture-freshness').textContent += ' · Actualisation momentanément indisponible.'; });
  }
})();
