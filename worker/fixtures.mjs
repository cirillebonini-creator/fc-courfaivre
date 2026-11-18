// ASF calendar extraction, scoped to match rows. Preserve official text and order.
export function parseFixtures(html) {
  const clean = value => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
  function field(block, name) {
    const open = new RegExp('<div\\b[^>]*class="[^"]*\\b' + name + '\\b[^"]*"[^>]*>', 'i').exec(block);
    if (!open) return '';
    const start = open.index + open[0].length;
    const tags = /<\/?div\b[^>]*>/gi; tags.lastIndex = start;
    let depth = 1, tag;
    while ((tag = tags.exec(block))) {
      depth += tag[0].startsWith('</') ? -1 : 1;
      if (!depth) return clean(block.slice(start, tag.index));
    }
    return '';
  }
  const starts = [...html.matchAll(/<div\b[^>]*class="[^"]*\brow spiel\b[^"]*"[^>]*>/gi)];
  if (!starts.length || !html.includes('tbResultate')) throw new Error('ASF calendar format unavailable');
  return starts.map((start, index) => {
    const block = html.slice(start.index, starts[index + 1]?.index ?? html.length);
    const dateText = field(block, 'date');
    const date = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const time = dateText.match(/\b\d{1,2}:\d{2}\b/)?.[0] || null;
    if (!date) throw new Error('ASF match date unavailable');
    return { date: `${date[3]}-${date[2]}-${date[1]}`, time, home: field(block, 'teamA'), away: field(block, 'teamB'), status: field(block, 'sppStatusText'), played: /^\d+$/.test(field(block, 'torA')) || /^\d+$/.test(field(block, 'torB')), number: clean(block).match(/N° match (\d+)/)?.[1] || null };
  }).filter(match => /Courfaivre/i.test(match.home + match.away));
}
