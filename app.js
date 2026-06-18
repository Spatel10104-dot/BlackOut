// -------------------- FIREBASE SETUP --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// -------------------- ELEMENTS --------------------
const totalEl = document.getElementById("total");
const todayEl = document.getElementById("today");
const modal = document.getElementById("modal");
const closeBtn = document.getElementById("close");

const BASE_CHANCE = 0.05;
const TIER_DRINKS = 4;
const TIER_ADD = 0.075;

const todayKey = () => new Date().toDateString();

let state = JSON.parse(localStorage.getItem("blackout")) || {
  tripTotal: 0,
  dayDrinks: 0,
  lastDay: todayKey(),
  trip: { beer: 0, cocktail: 0, shot: 0 },
  today: { beer: 0, cocktail: 0, shot: 0 }
};

if (!state.trip) state.trip = { beer: 0, cocktail: 0, shot: 0 };
if (!state.today) state.today = { beer: 0, cocktail: 0, shot: 0 };

function save() {
  localStorage.setItem("blackout", JSON.stringify(state));
}

function resetIfNewDay() {
  if (state.lastDay !== todayKey()) {
    state.dayDrinks = 0;
    state.lastDay = todayKey();
    state.today = { beer: 0, cocktail: 0, shot: 0 };
  }
}

// -------------------- UNDO LOGIC --------------------
let pressTimer = null;
let longPressTriggered = false;
let lastType = null;

function startPress() {
  longPressTriggered = false;
  pressTimer = setTimeout(() => {
    undoLastDrink();
    longPressTriggered = true;
  }, 2000);
}

function endPress() {
  clearTimeout(pressTimer);
}

function undoLastDrink() {
  if (state.tripTotal <= 0 || state.dayDrinks <= 0) return;
  state.tripTotal--;
  state.dayDrinks--;
  if (lastType) {
    if (state.trip[lastType] > 0) state.trip[lastType]--;
    if (state.today[lastType] > 0) state.today[lastType]--;
  }
  updateUI();
  save();
  if (navigator.vibrate) navigator.vibrate(20);
}

// -------------------- LOG DRINK --------------------
document.querySelectorAll(".drink").forEach(el => {
  el.addEventListener("touchstart", startPress);
  el.addEventListener("touchend", endPress);
  el.addEventListener("touchcancel", endPress);
  el.addEventListener("click", () => {
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }
    resetIfNewDay();

    const type = el.dataset.type;
    lastType = type;

    state.tripTotal++;
    state.dayDrinks++;
    state.trip[type]++;
    state.today[type]++;

    const tiers = Math.floor(state.dayDrinks / TIER_DRINKS);
    const chance = BASE_CHANCE + tiers * TIER_ADD;
    if (Math.random() < chance) {
      modal.classList.remove("hidden");
    }

    updateUI();
    save();
  });
});

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
}

// -------------------- MODAL --------------------
closeBtn.onclick = () => modal.classList.add("hidden");

// -------------------- TAB BAR --------------------
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.screen;
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById("screen-" + target).classList.add("active");
    tab.classList.add("active");
  });
});

// Land on blackout tab by default
document.getElementById("screen-blackout").classList.add("active");

// Initial render
updateUI();

// -------------------- HOME SCREEN --------------------
const plusBtn = document.getElementById("plus-btn");
const sessionSheet = document.getElementById("session-sheet");
const cancelBtn = document.getElementById("cancel-btn");

plusBtn.addEventListener("click", () => {
  sessionSheet.classList.remove("hidden");
});

cancelBtn.addEventListener("click", () => {
  sessionSheet.classList.add("hidden");
});

sessionSheet.addEventListener("click", (e) => {
  if (e.target === sessionSheet) sessionSheet.classList.add("hidden");
});
