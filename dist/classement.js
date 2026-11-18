(async () => {
  const crestIds = {"FC Courfaivre":"10110","FC Bure":"10106","FC Haute-Ajoie":"10164","FC Porrentruy":"10131","FC Lugnez-Damphreux":"10125","FC Coeuve":"10154","FC Alle":"10101","FC Courtedoux":"10142","FC Ajoie-Monterri":"10171","FC Glovelier":"10122","FC Vendlincourt":"10158","FC La Courtine":"10121","FC Perrefitte":"10130","FC Rebeuvelier":"10132","CS Vallon":"10173","SR Delémont":"10117","Birse Football Club":"10174","FC Vicques":"10139","FC Franches-Montagnes":"10145","FC Haute-Sorne":"10163","CS Belprahon":"10159","FC Develier":"10118","FC Courtételle":"10115","FC Bassecourt":"10102","FC Courrendlin-Courroux":"10172","FC Clos du Doubs":"10153","FC Aesch":"3501","FC Val Terbi":"10168","FC La Neuveville-Lamboing":"10254","FC Courtemaîche":"10114"};
  const crestFor = name => {
    const clean = name.replace(/\s*\([^)]*\)/g, '').replace(/\s+[abc]$/i, '').trim();
    const id = crestIds[clean];
    return id ? 'blasons/' + id + '.gif' : null;
  };
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
          if (key === 'club') {
            const label = document.createElement('span'); label.className = 'ranking-club';
            const src = crestFor(record.club);
            if (src) { const img = document.createElement('img'); img.src = src; img.alt = ''; img.width = 32; img.height = 32; img.loading = 'lazy'; img.addEventListener('error', () => img.remove(), { once: true }); label.append(img); }
            label.append(document.createTextNode(record.club)); cell.append(label);
          } else cell.textContent = record[key];
          row.append(cell);
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
