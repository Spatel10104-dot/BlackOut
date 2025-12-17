const totalEl = document.getElementById("total");
const modal = document.getElementById("modal");
const closeBtn = document.getElementById("close");

const BASE_CHANCE = 0.05;   // 5%
const TIER_DRINKS = 4;      // every 4 drinks
const TIER_ADD = 0.075;     // +7.5%

const todayKey = () => new Date().toDateString();

let state = JSON.parse(localStorage.getItem("blackout")) || {
  tripTotal: 0,
  dayDrinks: 0,
  lastDay: todayKey()
};

function save() {
  localStorage.setItem("blackout", JSON.stringify(state));
}

function resetIfNewDay() {
  if (state.lastDay !== todayKey()) {
    state.dayDrinks = 0;
    state.lastDay = todayKey();
  }
}

// -------------------- LOG DRINK --------------------
document.querySelectorAll(".drink").forEach(el => {
  el.addEventListener("click", () => {
    resetIfNewDay();

    state.tripTotal++;
    state.dayDrinks++;

    const tiers = Math.floor(state.dayDrinks / TIER_DRINKS);
    const chance = BASE_CHANCE + tiers * TIER_ADD;

    if (Math.random() < chance) {
      modal.classList.remove("hidden");
    }

    totalEl.textContent = state.tripTotal;
    save();
  });
});

// -------------------- UNDO (2s LONG PRESS) --------------------
let pressTimer = null;

document.body.addEventListener("touchstart", () => {
  pressTimer = setTimeout(undoLastDrink, 2000); // 2 seconds
});

document.body.addEventListener("touchend", () => {
  clearTimeout(pressTimer);
});

document.body.addEventListener("touchcancel", () => {
  clearTimeout(pressTimer);
});

function undoLastDrink() {
  if (state.tripTotal <= 0 || state.dayDrinks <= 0) return;

  state.tripTotal--;
  state.dayDrinks--;

  totalEl.textContent = state.tripTotal;
  save();

  // subtle haptic feedback if supported
  if (navigator.vibrate) navigator.vibrate(20);
}

// -------------------- MODAL --------------------
closeBtn.onclick = () => modal.classList.add("hidden");

// Initial render
totalEl.textContent = state.tripTotal;
