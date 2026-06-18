// Toolbar UI logic. Talks to the main process via the `floaty` preload bridge.
const $ = (id) => document.getElementById(id);

const address = $('address');
const backBtn = $('back');
const forwardBtn = $('forward');

// --- Button actions ---------------------------------------------------------
backBtn.addEventListener('click', () => window.floaty.back());
forwardBtn.addEventListener('click', () => window.floaty.forward());
$('reload').addEventListener('click', () => window.floaty.reload());
$('home').addEventListener('click', () => window.floaty.home());
$('minimize').addEventListener('click', () => window.floaty.minimize());
$('close').addEventListener('click', () => window.floaty.close());

// --- Settings panel ---------------------------------------------------------
const settingsPanel = $('settingsPanel');
const homeInput = $('homeInput');
const ratioSelect = $('ratioSelect');
const themeSelect = $('themeSelect');
const launchSelect = $('launchSelect');
const saveBtn = $('settingsSave');

function applyTheme(theme) {
  document.body.dataset.theme = theme || 'dark';
}

// Apply the saved theme as soon as the toolbar loads.
applyTheme(window.floaty.getTheme());

// Snapshot of the values when the panel was opened, used to detect changes.
let initial = { home: '', ratio: '', theme: '', launch: false };

// Enable Save only when something differs from the opened-state.
function updateDirty() {
  const changed =
    homeInput.value.trim() !== initial.home ||
    ratioSelect.value !== initial.ratio ||
    themeSelect.value !== initial.theme ||
    (launchSelect.value === 'on') !== initial.launch;
  saveBtn.disabled = !changed;
}

function openSettings() {
  initial = {
    home: window.floaty.getHome(),
    ratio: window.floaty.getRatio(),
    theme: window.floaty.getTheme(),
    launch: window.floaty.getLaunch(),
  };
  homeInput.value = initial.home;
  ratioSelect.value = initial.ratio;
  themeSelect.value = initial.theme;
  launchSelect.value = initial.launch ? 'on' : 'off';
  updateDirty();                       // dimmed until a real change
  settingsPanel.classList.add('open');
  window.floaty.openSettings();
  homeInput.focus();
}

function closeSettings() {
  // Revert any live color preview to the last saved theme.
  applyTheme(window.floaty.getTheme());
  settingsPanel.classList.remove('open');
  window.floaty.closeSettings();
}

$('settings').addEventListener('click', openSettings);
$('settingsCancel').addEventListener('click', closeSettings);

// Open the maker credit (Instagram) in the system browser.
$('creditLink').addEventListener('click', () => {
  window.floaty.openExternal($('creditLink').dataset.href);
});
saveBtn.addEventListener('click', () => {
  if (saveBtn.disabled) return;        // nothing changed
  const value = homeInput.value.trim();
  if (value) window.floaty.setHome(value);
  window.floaty.setRatio(ratioSelect.value);
  window.floaty.setTheme(themeSelect.value);
  window.floaty.setLaunch(launchSelect.value === 'on');
  closeSettings();
});

// Track changes to toggle the Save button's active state.
homeInput.addEventListener('input', updateDirty);
ratioSelect.addEventListener('change', updateDirty);
launchSelect.addEventListener('change', updateDirty);
themeSelect.addEventListener('change', () => {
  applyTheme(themeSelect.value);       // live colour preview
  updateDirty();
});

// Enter to save, Esc to cancel while editing the home page.
homeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('settingsSave').click();
  else if (e.key === 'Escape') closeSettings();
});

// --- Address bar ------------------------------------------------------------
address.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.floaty.navigate(address.value);
    address.blur();
  }
});

// Select-all on focus for quick replacement.
address.addEventListener('focus', () => address.select());

// --- Navigation state from main --------------------------------------------
window.floaty.onNavState((state) => {
  // Don't clobber what the user is typing.
  if (document.activeElement !== address) {
    address.value = state.url || '';
  }
  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;
});
