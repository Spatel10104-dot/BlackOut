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

document.querySelectorAll(".drink").forEach(el => {
  el.addEventListener("click", () => {
    resetIfNewDay();

    // Log drink
    state.tripTotal++;
    state.dayDrinks++;

    // Calculate probability
    const tiers = Math.floor(state.dayDrinks / TIER_DRINKS);
    const chance = BASE_CHANCE + tiers * TIER_ADD;

    // Roll
    if (Math.random() < chance) {
      modal.classList.remove("hidden");
    }

    totalEl.textContent = state.tripTotal;
    save();
  });
});

closeBtn.onclick = () => modal.classList.add("hidden");

// Initial render
totalEl.textContent = state.tripTotal;
