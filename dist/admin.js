const labels = { premiere: 'Première équipe', deuxieme: 'Deuxième équipe', veterans: 'Vétérans' };
const byId = id => document.getElementById(id);
const filter = byId('team-filter');
const search = byId('player-search');
const list = byId('admin-players');
const status = byId('admin-status');
const dialog = byId('player-dialog');
const form = byId('player-form');
const fields = form.elements;
const formStatus = byId('form-status');
const add = byId('new-player');
const remove = byId('delete-player');
const close = byId('close-player');
let players = [];
let selected;
let busy = false;

const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');

function render() {
  const query = normalize(search.value.trim());
  const visible = players.filter(p => (!filter.value || p.team === filter.value) && normalize(p.firstName + ' ' + p.lastName + ' ' + p.lastName + ' ' + p.firstName).includes(query));
  list.replaceChildren(...visible.map(player => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = player.firstName + ' ' + player.lastName;
    const description = document.createElement('span');
    description.textContent = [labels[player.team], player.position, player.nationality].filter(Boolean).join(' · ');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Modifier';
    edit.setAttribute('aria-label', 'Modifier ' + name.textContent);
    edit.addEventListener('click', () => openPlayer(player));
    item.append(name, description, edit);
    return item;
  }));
  status.textContent = visible.length + (visible.length === 1 ? ' joueur' : ' joueurs');
}

async function request(path, options) {
  const response = await fetch(path, options);
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Connexion au site indisponible.'); }
  if (!response.ok) throw new Error(payload.error || 'Une erreur est survenue.');
  return payload;
}

async function load() {
  const data = await request('/api/joueurs');
  players = Object.values(data).flat();
  render();
  add.disabled = false;
}

function openPlayer(player) {
  form.reset();
  selected = player;
  byId('form-title').textContent = player ? 'Modifier le joueur' : 'Ajouter un joueur';
  for (const key of ['firstName', 'lastName', 'nationality', 'position']) fields[key].value = player?.[key] || '';
  fields.team.value = player?.team || filter.value || 'premiere';
  const photo = byId('current-portrait');
  if (player?.photo) photo.src = player.photo;
  else photo.removeAttribute('src');
  photo.hidden = !player?.photo;
  byId('remove-portrait').hidden = !player?.photo;
  remove.hidden = !player;
  formStatus.textContent = '';
  dialog.showModal();
}

async function encodePortrait(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choisis une photo JPG, PNG ou WebP.');
  if (file.size > 15_000_000) throw new Error('La photo originale dépasse 15 Mo.');
  const bitmap = await createImageBitmap(file);
  try {
    const factor = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', 0.82);
    if (!data.startsWith('data:image/webp;base64,') || data.length > 500000) throw new Error('Impossible de préparer cette photo.');
    return data.split(',')[1];
  } finally { bitmap.close(); }
}

async function save(deleting = false) {
  if (busy) return;
  if (deleting && !confirm('Retirer ce joueur de l’effectif affiché ?')) return;
  busy = true;
  close.disabled = true;
  remove.disabled = true;
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  formStatus.textContent = 'Enregistrement…';
  try {
    const input = { revision: selected?.revision };
    if (!deleting) {
      for (const key of ['firstName', 'lastName', 'nationality', 'position', 'team']) input[key] = fields[key].value;
      const file = fields.photo.files[0];
      if (file) input.portrait = await encodePortrait(file);
      else if (fields.removePhoto.checked) input.portrait = null;
    }
    await request('/api/joueurs' + (selected ? '/' + selected.id : ''), {
      method: deleting ? 'DELETE' : selected ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    dialog.close();
    try {
      await load();
      status.textContent += deleting ? ' · Joueur retiré' : ' · Fiche enregistrée';
    } catch {
      status.textContent = 'Modification enregistrée. Recharge la page pour retrouver la liste.';
    }
  } catch (error) {
    formStatus.textContent = error.message;
  } finally {
    busy = false;
    close.disabled = false;
    remove.disabled = false;
    submit.disabled = false;
  }
}

filter.addEventListener('change', render);
search.addEventListener('input', render);
add.addEventListener('click', () => openPlayer());
close.addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
remove.addEventListener('click', () => save(true));
form.addEventListener('submit', event => { event.preventDefault(); save(); });
load().catch(error => { status.textContent = error.message; });
