// -------------------- FIREBASE SETUP --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCFA74PQx7_hLUIaXKTx94883_NYPNXn48",
  authDomain: "blackout-392f7.firebaseapp.com",
  projectId: "blackout-392f7",
  storageBucket: "blackout-392f7.firebasestorage.app",
  messagingSenderId: "192371362924",
  appId: "1:192371362924:web:8794437e39084b27ad1c49",
  measurementId: "G-M4VENDQ1M7",
  databaseURL: "https://blackout-392f7-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// -------------------- STATE --------------------
const BASE_CHANCE = 0.05;
const TIER_DRINKS = 4;
const TIER_ADD = 0.075;
const todayKey = () => new Date().toDateString();

let state = JSON.parse(localStorage.getItem("blackout")) || {
  tripTotal: 0, dayDrinks: 0, lastDay: todayKey(),
  trip: { beer: 0, cocktail: 0, shot: 0 },
  today: { beer: 0, cocktail: 0, shot: 0 }
};
if (!state.trip) state.trip = { beer: 0, cocktail: 0, shot: 0 };
if (!state.today) state.today = { beer: 0, cocktail: 0, shot: 0 };

let currentSession = JSON.parse(localStorage.getItem("blackout-session")) || null;
let myName = localStorage.getItem("blackout-name") || null;
let currentRecapCode = null;

function save() { localStorage.setItem("blackout", JSON.stringify(state)); }
function saveSession(s) { localStorage.setItem("blackout-session", JSON.stringify(s)); }

function resetIfNewDay() {
  if (state.lastDay !== todayKey()) {
    state.dayDrinks = 0;
    state.lastDay = todayKey();
    state.today = { beer: 0, cocktail: 0, shot: 0 };
  }
}

// -------------------- ELEMENTS --------------------
const totalEl = document.getElementById("total");
const todayEl = document.getElementById("today");
const modal = document.getElementById("modal");
const closeBtn = document.getElementById("close");

// -------------------- UNDO --------------------
let lastType = null;

function undoLastDrink() {
  if (state.tripTotal <= 0 || state.dayDrinks <= 0) return;
  state.tripTotal--; state.dayDrinks--;
  if (lastType) {
    if (state.trip[lastType] > 0) state.trip[lastType]--;
    if (state.today[lastType] > 0) state.today[lastType]--;
  }
  updateUI(); save();
  if (currentSession && myName) syncDrinkToFirebase();
  if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
}

document.getElementById("undo-btn").addEventListener("click", undoLastDrink);

// -------------------- LOG DRINK --------------------
document.querySelectorAll(".drink").forEach(el => {
  el.addEventListener("click", () => {
    resetIfNewDay();
    const type = el.dataset.type;
    lastType = type;
    state.tripTotal++; state.dayDrinks++;
    state.trip[type]++; state.today[type]++;
    const tiers = Math.floor(state.dayDrinks / TIER_DRINKS);
    const chance = BASE_CHANCE + tiers * TIER_ADD;
    if (Math.random() < chance) triggerShotModal();
    updateUI(); save();
    if (currentSession && myName) syncDrinkToFirebase();
  });
});

// -------------------- SYNC TO FIREBASE --------------------
function syncDrinkToFirebase() {
  update(ref(db, `sessions/${currentSession.code}/players/${myName}`), {
    tripTotal: state.tripTotal,
    dayDrinks: state.dayDrinks,
    trip: state.trip,
    today: state.today
  });
}

// -------------------- UI --------------------
function updateUI() {
  totalEl.textContent = state.tripTotal;
  todayEl.textContent = state.dayDrinks;
  document.getElementById("stat-today-beer").textContent = state.today.beer;
  document.getElementById("stat-today-cocktail").textContent = state.today.cocktail;
  document.getElementById("stat-today-shot").textContent = state.today.shot;
  document.getElementById("stat-today-total").textContent = state.dayDrinks;
  document.getElementById("stat-trip-beer").textContent = state.trip.beer;
  document.getElementById("stat-trip-cocktail").textContent = state.trip.cocktail;
  document.getElementById("stat-trip-shot").textContent = state.trip.shot;
  document.getElementById("stat-trip-total").textContent = state.tripTotal;

  // Stats heading — show trip name if in session
  const statsHeading = document.getElementById("stats-heading");
  if (currentSession && currentSession.name) {
    statsHeading.textContent = currentSession.name;
  } else {
    statsHeading.textContent = "Stats";
  }

  // End Night button — only show if in session or drinks logged
  const endNightBtn = document.getElementById("end-night-btn");
  if (currentSession || state.tripTotal > 0) {
    endNightBtn.classList.remove("hidden");
  } else {
    endNightBtn.classList.add("hidden");
  }
}

// -------------------- SHOT MODAL --------------------
async function triggerShotModal() {
  if (!currentSession) {
    // No session — show basic modal
    showBasicModal("Other person takes a shot");
    return;
  }

  const snapshot = await get(ref(db, `sessions/${currentSession.code}/players`));
  if (!snapshot.exists()) { showBasicModal("Other person takes a shot"); return; }

  const players = snapshot.val();
  const others = Object.keys(players).filter(n => n !== myName);

  if (others.length === 0) {
    showBasicModal("Other person takes a shot");
  } else if (others.length === 1) {
    showBasicModal(`${others[0]} takes a shot! 🥃`);
    notifyPlayer(others[0]);
  } else {
    showPickModal(others);
  }
}

function showBasicModal(text) {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  document.getElementById("modal-text").textContent = text;
  document.getElementById("name-cards-container").classList.add("hidden");
  document.getElementById("send-it-btn").classList.add("hidden");
  document.getElementById("close").classList.remove("hidden");
  modal.classList.remove("hidden");
}

function showPickModal(players) {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  document.getElementById("modal-text").textContent = "Who takes the shot?";
  document.getElementById("close").classList.add("hidden");
  document.getElementById("send-it-btn").classList.remove("hidden");
  document.getElementById("send-it-btn").classList.remove("ready");

  const container = document.getElementById("name-cards-container");
  container.innerHTML = "";
  container.classList.remove("hidden");

  players.forEach(name => {
    const card = document.createElement("button");
    card.className = "name-card";
    card.textContent = name;
    card.addEventListener("click", () => {
      document.querySelectorAll(".name-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("send-it-btn").classList.add("ready");
      document.getElementById("modal-text").textContent = `${name} takes a shot! 🥃`;
    });
    container.appendChild(card);
  });

  modal.classList.remove("hidden");
}

function notifyPlayer(name) {
  if (!currentSession) return;
  update(ref(db, `sessions/${currentSession.code}/notifications/${name}`), {
    message: `${myName} says you take a shot! 🥃`,
    timestamp: Date.now()
  });
}

closeBtn.onclick = () => modal.classList.add("hidden");

document.getElementById("send-it-btn").addEventListener("click", () => {
  const selected = document.querySelector(".name-card.selected");
  if (!selected) return;
  notifyPlayer(selected.textContent);
  modal.classList.add("hidden");
});

// -------------------- TAB BAR --------------------
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.screen;
    if (target === "home") loadTrips();
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById("screen-" + target).classList.add("active");
    tab.classList.add("active");
  });
});

// -------------------- HOME SCREEN - LOAD TRIPS --------------------
async function loadTrips() {
  const tripsList = document.getElementById("trips-list");
  const emptyState = document.getElementById("empty-state");
  const snapshot = await get(ref(db, "sessions"));
  if (!snapshot.exists()) { emptyState.classList.remove("hidden"); return; }
  const sessions = snapshot.val();
  const myTrips = Object.values(sessions).filter(s => s.players && s.players[myName]);
  if (myTrips.length === 0) { emptyState.classList.remove("hidden"); return; }
  emptyState.classList.add("hidden");
  tripsList.innerHTML = "";
  myTrips.sort((a, b) => b.createdAt - a.createdAt).forEach(trip => {
    const date = new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const card = document.createElement("div");
    card.className = "trip-card";
    card.innerHTML = `<div class="trip-name">${trip.name}</div><div class="trip-date">${date}</div>`;
    card.addEventListener("click", () => openRecap(trip.code));
    tripsList.appendChild(card);
  });
}

// -------------------- RECAP SCREEN --------------------
async function openRecap(code) {
  currentRecapCode = code;
  const snapshot = await get(ref(db, `sessions/${code}`));
  if (!snapshot.exists()) return;
  const session = snapshot.val();
  const date = new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const players = session.players || {};
  const playerNames = Object.keys(players);

  document.getElementById("recap-title").textContent = session.name;
  document.getElementById("recap-meta").textContent = `${date} · ${playerNames.length} player${playerNames.length > 1 ? "s" : ""}`;

  // Build player dropdown — my name first
  const dropdown = document.getElementById("recap-player-dropdown");
  const btn = document.getElementById("recap-player-btn-label");
  dropdown.innerHTML = "";
  const ordered = [myName, ...playerNames.filter(n => n !== myName)];
  ordered.forEach((name, i) => {
    const opt = document.createElement("div");
    opt.className = "player-option" + (i === 0 ? " selected" : "");
    opt.textContent = name + (i === 0 ? " ✓" : "");
    opt.addEventListener("click", () => {
      document.querySelectorAll(".player-option").forEach(o => { o.classList.remove("selected"); o.textContent = o.textContent.replace(" ✓", ""); });
      opt.classList.add("selected");
      opt.textContent = name + " ✓";
      btn.textContent = name + "'s Drinks";
      dropdown.classList.remove("show");
      document.getElementById("recap-player-btn").classList.remove("open");
      showPlayerStats(players[name]);
    });
    dropdown.appendChild(opt);
  });

  btn.textContent = (myName || playerNames[0]) + "'s Drinks";
  showPlayerStats(players[myName] || players[playerNames[0]]);

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-recap").classList.add("active");
  loadRecapPhotos(code);
}

function showPlayerStats(playerData) {
  if (!playerData) return;
  const trip = playerData.trip || { beer: 0, cocktail: 0, shot: 0 };
  document.getElementById("recap-beer").textContent = trip.beer || 0;
  document.getElementById("recap-cocktail").textContent = trip.cocktail || 0;
  document.getElementById("recap-shot").textContent = trip.shot || 0;
  document.getElementById("recap-total").textContent = playerData.tripTotal || 0;
}

document.getElementById("recap-back").addEventListener("click", () => {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("screen-home").classList.add("active");
  document.querySelector(".tab[data-screen='home']").classList.add("active");
  loadTrips();
});

document.getElementById("recap-three-dot").addEventListener("click", () => {
  document.getElementById("recap-dot-menu").classList.toggle("hidden");
});

document.getElementById("recap-dot-cancel").addEventListener("click", () => {
  document.getElementById("recap-dot-menu").classList.add("hidden");
});

document.getElementById("recap-delete").addEventListener("click", () => {
  document.getElementById("recap-dot-menu").classList.add("hidden");
  document.getElementById("delete-confirm-modal").classList.remove("hidden");
  document.getElementById("delete-trip-name").textContent = document.getElementById("recap-title").textContent;
});

document.getElementById("delete-cancel").addEventListener("click", () => {
  document.getElementById("delete-confirm-modal").classList.add("hidden");
});

document.getElementById("delete-confirm").addEventListener("click", async () => {
  await remove(ref(db, `sessions/${currentRecapCode}`));
  document.getElementById("delete-confirm-modal").classList.add("hidden");
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("screen-home").classList.add("active");
  document.querySelector(".tab[data-screen='home']").classList.add("active");
  loadTrips();
});

document.getElementById("recap-player-btn").addEventListener("click", () => {
  document.getElementById("recap-player-dropdown").classList.toggle("show");
  document.getElementById("recap-player-btn").classList.toggle("open");
});

// -------------------- END NIGHT --------------------
document.getElementById("end-night-btn").addEventListener("click", () => {
  document.getElementById("end-night-modal").classList.remove("hidden");
});

document.getElementById("end-night-cancel").addEventListener("click", () => {
  document.getElementById("end-night-modal").classList.add("hidden");
});

document.getElementById("end-night-confirm").addEventListener("click", async () => {
  // Save final stats to Firebase before resetting
  if (currentSession && myName) {
    await update(ref(db, `sessions/${currentSession.code}/players/${myName}`), {
      tripTotal: state.tripTotal,
      dayDrinks: state.dayDrinks,
      trip: state.trip,
      today: state.today,
      endedAt: Date.now()
    });
  }

  // Reset only this user's local state
  currentSession = null;
  localStorage.removeItem("blackout-session");
  state = { tripTotal: 0, dayDrinks: 0, lastDay: todayKey(), trip: { beer: 0, cocktail: 0, shot: 0 }, today: { beer: 0, cocktail: 0, shot: 0 } };
  save();
  document.getElementById("end-night-modal").classList.add("hidden");
  updateUI();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("screen-home").classList.add("active");
  document.querySelector(".tab[data-screen='home']").classList.add("active");
  loadTrips();
});

// -------------------- SESSION SHEET --------------------
const sessionSheet = document.getElementById("session-sheet");
document.getElementById("plus-btn").addEventListener("click", () => sessionSheet.classList.remove("hidden"));
document.getElementById("cancel-btn").addEventListener("click", closeAllSheets);
sessionSheet.addEventListener("click", e => { if (e.target === sessionSheet) closeAllSheets(); });

function closeAllSheets() {
  ["session-sheet","create-sheet","join-sheet","code-sheet"].forEach(id => document.getElementById(id).classList.add("hidden"));
}

document.getElementById("create-btn").addEventListener("click", () => {
  sessionSheet.classList.add("hidden");
  document.getElementById("create-sheet").classList.remove("hidden");
});

document.getElementById("create-confirm").addEventListener("click", async () => {
  const nameInput = document.getElementById("create-name-input").value.trim();
  const sessionName = document.getElementById("session-name-input").value.trim();
  if (!nameInput || !sessionName) { alert("Please fill in both fields"); return; }
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  myName = nameInput;
  localStorage.setItem("blackout-name", myName);
  await set(ref(db, `sessions/${code}`), {
    name: sessionName, code, createdAt: Date.now(),
    players: { [myName]: { tripTotal: 0, dayDrinks: 0, trip: { beer: 0, cocktail: 0, shot: 0 }, today: { beer: 0, cocktail: 0, shot: 0 } } }
  });
  currentSession = { code, name: sessionName };
  saveSession(currentSession);
  document.getElementById("create-sheet").classList.add("hidden");
  document.getElementById("display-code").textContent = code;
  document.getElementById("display-session-name").textContent = sessionName;
  document.getElementById("code-sheet").classList.remove("hidden");
  startNotificationListener();
});

document.getElementById("code-done").addEventListener("click", () => {
  closeAllSheets();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("screen-blackout").classList.add("active");
  document.querySelector(".tab[data-screen='blackout']").classList.add("active");
});

document.getElementById("join-btn").addEventListener("click", () => {
  sessionSheet.classList.add("hidden");
  document.getElementById("join-sheet").classList.remove("hidden");
});

document.getElementById("join-confirm").addEventListener("click", async () => {
  const code = document.getElementById("join-code-input").value.trim();
  const nameInput = document.getElementById("join-name-input").value.trim();
  if (!code || !nameInput) { alert("Please fill in both fields"); return; }
  const snapshot = await get(ref(db, `sessions/${code}`));
  if (!snapshot.exists()) { alert("Session not found. Check the code and try again."); return; }
  const sessionData = snapshot.val();
  myName = nameInput;
  localStorage.setItem("blackout-name", myName);
  currentSession = { code, name: sessionData.name };
  saveSession(currentSession);
  await set(ref(db, `sessions/${code}/players/${myName}`), {
    tripTotal: 0, dayDrinks: 0,
    trip: { beer: 0, cocktail: 0, shot: 0 },
    today: { beer: 0, cocktail: 0, shot: 0 }
  });
  closeAllSheets();
  startNotificationListener();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("screen-blackout").classList.add("active");
  document.querySelector(".tab[data-screen='blackout']").classList.add("active");
});

document.getElementById("cancel-create").addEventListener("click", closeAllSheets);
document.getElementById("cancel-join").addEventListener("click", closeAllSheets);

// -------------------- INIT --------------------
updateUI();

function startNotificationListener() {
  if (!currentSession || !myName) return;
  onValue(ref(db, `sessions/${currentSession.code}/notifications/${myName}`), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    if (data && data.message && data.timestamp > Date.now() - 10000) {
      showBasicModal(data.message);
    }
  });
}

if (currentSession && myName) {
  startNotificationListener();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("screen-blackout").classList.add("active");
  document.querySelector(".tab[data-screen='blackout']").classList.add("active");
}

// -------------------- PHOTO FEATURE --------------------
const cameraBtn = document.getElementById("camera-btn");
const photoInput = document.getElementById("photo-input");

cameraBtn.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const photoData = e.target.result;
    const sessionKey = currentSession ? currentSession.code : "solo";
    const photos = JSON.parse(localStorage.getItem(`photos-${sessionKey}`)) || [];
    photos.push({ data: photoData, timestamp: Date.now(), name: myName || "Me" });
    localStorage.setItem(`photos-${sessionKey}`, JSON.stringify(photos));
  };
  reader.readAsDataURL(file);
  photoInput.value = "";
});

function loadRecapPhotos(code) {
  const grid = document.getElementById("recap-photos-grid");
  const sessionKey = code || "solo";
  const photos = JSON.parse(localStorage.getItem(`photos-${sessionKey}`)) || [];
  if (photos.length === 0) {
    grid.innerHTML = '<div class="photos-placeholder">📷 No photos yet</div>';
    return;
  }
  grid.innerHTML = "";
  photos.sort((a, b) => b.timestamp - a.timestamp).forEach(photo => {
    const img = document.createElement("img");
    img.src = photo.data;
    img.className = "recap-photo";
    grid.appendChild(img);
  });
}
