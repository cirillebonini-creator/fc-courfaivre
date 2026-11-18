const links = [...document.querySelectorAll('.gallery-photo')];
const dialog = document.querySelector('.photo-viewer');
const large = document.querySelector('#photo-large');
let current = 0;
function show(index) {
 current = (index + links.length) % links.length;
 large.src = links[current].href;
 large.alt = links[current].querySelector('img').alt;
 document.querySelector('#photo-counter').textContent = `${current + 1} / ${links.length}`;
}
links.forEach((link, index) => link.addEventListener('click', event => {
 if (!dialog.showModal || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
 event.preventDefault(); show(index); dialog.showModal(); document.body.classList.add('photo-open');
}));
document.querySelector('#photo-close').addEventListener('click', () => dialog.close());
document.querySelector('#photo-prev').addEventListener('click', () => show(current - 1));
document.querySelector('#photo-next').addEventListener('click', () => show(current + 1));
dialog.addEventListener('keydown', event => {
 if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
 if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
});
dialog.addEventListener('close', () => { document.body.classList.remove('photo-open'); links[current].focus(); });
