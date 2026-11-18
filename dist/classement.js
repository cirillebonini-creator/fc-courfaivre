(async () => {
  const columns = [['rank', 'Rang'], ['club', 'Équipe'], ['played', 'MJ'], ['wins', 'V'], ['draws', 'N'], ['losses', 'D'], ['fairplay', 'Fair-play'], ['goals', 'Buts'], ['difference', 'Diff.'], ['points', 'Pts']];
  for (const container of document.querySelectorAll('[data-standings]')) {
    const card = container.closest('.standings-card');
    const status = card.querySelector('.standings-status');
    try {
      const response = await fetch('/api/classement/' + container.dataset.standings, { signal: AbortSignal.timeout(16000) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!data.rows?.length) throw new Error();
      const table = document.createElement('table');
      table.className = 'fcc-ranking';
      const caption = table.createCaption();
      caption.textContent = 'Classement officiel ASF · ' + card.querySelector('h3').textContent;
      const header = table.createTHead().insertRow();
      for (const [, label] of columns) {
        const cell = document.createElement('th');
        cell.scope = 'col'; cell.textContent = label; header.append(cell);
      }
      const body = table.createTBody();
      for (const record of data.rows) {
        const row = body.insertRow();
        if (/\bCourfaivre\b/i.test(record.club)) row.className = 'standings-fcc';
        for (const [key] of columns) {
          const cell = document.createElement(key === 'club' ? 'th' : 'td');
          if (key === 'club') cell.scope = 'row';
          cell.textContent = record[key]; row.append(cell);
        }
      }
      container.append(table); container.hidden = false;
      status.textContent = (data.stale ? 'Source ASF · Copie du ' : 'Source ASF · Actualisé le ') + new Intl.DateTimeFormat('fr-CH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Zurich' }).format(new Date(data.fetchedAt)) + (data.stale ? ' · Actualisation ASF momentanément indisponible.' : '');
      const note = document.createElement('p'); note.className = 'standings-legend';
      note.textContent = 'MJ : matchs joués · V : victoires · N : nuls · D : défaites. Ordre et valeurs de fair-play conservés selon l’ASF.';
      container.after(note);
    } catch {
      status.textContent = 'Le tableau personnalisé est momentanément indisponible. Le widget officiel reste accessible ci-dessous.';
      card.querySelector('details').open = true;
    }
  }
})();
