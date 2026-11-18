const roster = document.querySelector("[data-team]");
const list = roster.querySelector(".player-grid");
const status = roster.querySelector(".roster-status");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function playerCard(player) {
  const card = element("li", "player-card");
  const portrait = element("div", "player-portrait");
  if (player.photo) {
    const photo = element("img");
    photo.src = player.photo;
    photo.alt = "";
    photo.loading = "lazy";
    portrait.append(photo);
  } else {
    const initials = player.firstName[0] + player.lastName[0];
    const placeholder = element("span", "", initials.toLocaleUpperCase("fr"));
    placeholder.setAttribute("aria-hidden", "true");
    portrait.append(placeholder);
  }

  const info = element("div", "player-info");
  const name = element("h3", "", player.firstName + " " + player.lastName);
  const details = element("dl", "player-details");
  for (const [label, value] of [["Nationalité", player.nationality], ["Poste", player.position]]) {
    details.append(element("dt", "", label), element("dd", "", value || "À renseigner"));
  }
  info.append(name, details);
  card.append(portrait, info);
  return card;
}

async function showRoster() {
  try {
    const response = await fetch("/api/joueurs");
    if (!response.ok) throw new Error("Effectif indisponible");
    const data = await response.json();
    const players = data[roster.dataset.team];
    list.replaceChildren(...players.map(playerCard));
    status.hidden = true;
  } catch {
    status.textContent = "L’effectif est momentanément indisponible.";
  }
}

showRoster();
