const totalEl = document.getElementById("total");
const todayEl = document.getElementById("today");
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

// -------------------- UNDO LOGIC --------------------
let pressTimer = null;
let longPressTriggered = false;

function startPress() {
  longPressTriggered = false;
  pressTimer = setTimeout(() => {
    undoLastDrink();
    longPressTriggered = true;
  }, 2000); // 2 seconds
}

function endPress() {
  clearTimeout(pressTimer);
}

function undoLastDrink() {
  if (state.tripTotal <= 0 || state.dayDrinks <= 0) return;

  state.tripTotal--;
  state.dayDrinks--;

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
    // Block add if long press occurred
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    resetIfNewDay();

    state.tripTotal++;
    state.dayDrinks++;

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
}

// -------------------- MODAL --------------------
closeBtn.onclick = () => modal.classList.add("hidden");

// Initial render
updateUI();
