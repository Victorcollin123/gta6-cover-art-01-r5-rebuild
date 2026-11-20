// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover draws the cover alone, full frame, at the size
// the query asks for. window.__shotReady is set once painted.
import { SIZES } from './strip.js';

export async function runShot(shot, query, api) {
  const { state, applyGrade, setMode, loadImage, redraw, say } = api;
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const grade = query.get('grade') ?? 'sunset';
  const title = query.get('title') ?? 'VICE BOOTH';

  state.title = title;
  state.subtitle = caption;
  state.onePhoto = await loadImage(`samples/${photo}.jpg`);
  applyGrade(grade);
  setMode('one');
  const titleInput = document.getElementById('title');
  const subtitleInput = document.getElementById('subtitle');
  if (titleInput) titleInput.value = title;
  if (subtitleInput) subtitleInput.value = caption;
  say(`Sample ${photo}.jpg loaded — ${caption}.`);

  if (shot === 'cover') {
    const size = SIZES.find((s) => s.id === (query.get('size') ?? '1080x1350')) ?? SIZES[0];
    state.size = size.id;
    document.getElementById('size').value = size.id;
    document.body.classList.add('shot-cover');
    document.getElementById('preview').style.maxHeight = '100vh';
  }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
