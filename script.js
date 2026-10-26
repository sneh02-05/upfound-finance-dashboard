
const $ = (selector) => document.querySelector(selector);

const STORAGE_KEYS = {
    transactions: "upfound-transactions",
    goals: "upfound-goals"
};

let transactions = loadData(STORAGE_KEYS.transactions);
let goals = loadData(STORAGE_KEYS.goals);
let toastTimer;

function loadData(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatMoney(amount) {
    return Number(amount).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(date) {
    if (!date) return "—";
    const parts = date.split("-");
    if (parts.length !== 3) return date;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function todayString() {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}

function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const firstInput = modal.querySelector("input:not([type=radio])");
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

function openTransactionModal() {
    $("#transaction-form").reset();
    $("#transaction-date").value = todayString();
    $("#transaction-error").textContent = "";
    openModal("transaction-modal");
}

function openGoalModal() {
    $("#goal-form").reset();
    $("#goal-saved").value = "0";
    $("#goal-error").textContent = "";
    openModal("goal-modal");
}

function getTotals() {
    return transactions.reduce((totals, transaction) => {
        const amount = Number(transaction.amount) || 0;

        if (transaction.type === "income") {
            totals.income += amount;
        } else {
            totals.expenses += amount;
        }

        return totals;
    }, { income: 0, expenses: 0 });
}

function renderSummary() {
    const totals = getTotals();
    const balance = totals.income - totals.expenses;

    $("#total-balance").textContent = formatMoney(balance);
    $("#total-income").textContent = formatMoney(totals.income);
    $("#total-expenses").textContent = formatMoney(totals.expenses);

    $("#chart-income-label").textContent = formatMoney(totals.income);
    $("#chart-expense-label").textContent = formatMoney(totals.expenses);

    const maximum = Math.max(totals.income, totals.expenses, 1);
    $("#income-bar").style.width = `${(totals.income / maximum) * 100}%`;
    $("#expense-bar").style.width = `${(totals.expenses / maximum) * 100}%`;

    const title = $("#insight-title");
    const text = $("#insight-text");

    if (transactions.length === 0) {
        title.textContent = "Your financial snapshot";
        text.textContent = "Add your first transaction to see your cash flow insights.";
    } else if (balance > 0) {
        title.textContent = "You're in positive territory";
        text.textContent = `You have ${formatMoney(balance)} more in income than expenses across your recorded transactions.`;
    } else if (balance < 0) {
        title.textContent = "Expenses are ahead";
        text.textContent = `Recorded expenses exceed income by ${formatMoney(Math.abs(balance))}. Review your spending and plan your next move.`;
    } else {
        title.textContent = "Income and expenses are balanced";
        text.textContent = "Your recorded income and expenses currently match.";
    }
}

function renderTransactions() {
    const list = $("#transaction-list");
    const filter = $("#transaction-filter").value;

    const filtered = transactions
        .filter((item) => filter === "all" || item.type === filter)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span>↔</span>
                <h3>${transactions.length ? "No matching transactions" : "No transactions yet"}</h3>
                <p>${transactions.length ? "Try a different filter." : "Add your first income or expense to get started."}</p>
            </div>`;
        return;
    }

    list.innerHTML = filtered.map((item) => `
        <div class="transaction-row">
            <div class="transaction-name">
                <strong>${escapeHTML(item.title)}</strong>
                <small>${item.type === "income" ? "Money received" : "Money spent"}</small>
            </div>
            <span class="category-badge">${escapeHTML(item.category)}</span>
            <span class="transaction-date">${formatDate(item.date)}</span>
            <span class="transaction-amount ${item.type}">
                ${item.type === "income" ? "+" : "−"}${formatMoney(item.amount)}
            </span>
            <button class="delete-transaction" data-delete-transaction="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.title)}" title="Delete transaction">×</button>
        </div>
    `).join("");
}

function renderGoals() {
    const list = $("#goal-list");

    if (goals.length === 0) {
        list.innerHTML = `
            <div class="empty-goals">
                <p>No savings goals yet. Create one to start tracking your progress.</p>
            </div>`;
        return;
    }

    list.innerHTML = goals.map((goal) => {
        const saved = Number(goal.saved) || 0;
        const target = Number(goal.target) || 1;
        const percent = Math.min(100, Math.round((saved / target) * 100));
        const complete = saved >= target;

        return `
            <article class="goal-card">
                <div class="goal-card-top">
                    <h3>${escapeHTML(goal.name)}</h3>
                    <span class="goal-percent">${percent}%</span>
                </div>
                <div class="goal-track">
                    <div class="goal-progress" style="width:${percent}%"></div>
                </div>
                <div class="goal-details">
                    <span><strong>${formatMoney(saved)}</strong> saved</span>
                    <span>of ${formatMoney(target)}</span>
                </div>
                <div class="goal-actions">
                    ${complete ? `<span class="category-badge">Goal reached!</span>` : `<button class="secondary-btn" data-add-savings="${escapeHTML(goal.id)}">+ Add savings</button>`}
                    <button class="secondary-btn" data-delete-goal="${escapeHTML(goal.id)}">Delete</button>
                </div>
            </article>`;
    }).join("");
}

function renderAll() {
    renderSummary();
    renderTransactions();
    renderGoals();
}

$("#add-transaction-btn").addEventListener("click", openTransactionModal);
$("#quick-add").addEventListener("click", openTransactionModal);
$("#add-goal-btn").addEventListener("click", openGoalModal);
$("#quick-goal").addEventListener("click", openGoalModal);

$("#transaction-filter").addEventListener("change", renderTransactions);

document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeModal(overlay.id);
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal-overlay.open").forEach((modal) => closeModal(modal.id));
    }
});

$("#transaction-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const amount = Number(form.get("amount"));
    const date = String(form.get("date") || "");
    const category = String(form.get("category") || "Other");
    const type = String(form.get("type") || "income");

    if (!title || !Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
        $("#transaction-error").textContent = "Enter a description and a valid positive amount.";
        return;
    }

    if (!date || date > todayString()) {
        $("#transaction-error").textContent = "Choose a valid date that is today or earlier.";
        return;
    }

    transactions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title,
        amount: Math.round(amount * 100) / 100,
        category,
        date,
        type,
        createdAt: Date.now()
    });

    saveData();
    renderAll();
    closeModal("transaction-modal");
    showToast("Transaction saved successfully.");
});

$("#goal-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const target = Number(form.get("target"));
    const saved = Number(form.get("saved"));

    if (!name || !Number.isFinite(target) || target <= 0 || target > 100000000 ||
        !Number.isFinite(saved) || saved < 0 || saved > 100000000) {
        $("#goal-error").textContent = "Enter a goal name and valid amounts.";
        return;
    }

    if (saved > target) {
        $("#goal-error").textContent = "Already saved cannot exceed the target amount.";
        return;
    }

    goals.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        name,
        target: Math.round(target * 100) / 100,
        saved: Math.round(saved * 100) / 100
    });

    saveData();
    renderGoals();
    closeModal("goal-modal");
    showToast("Savings goal created.");
});

$("#transaction-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-transaction]");
    if (!button) return;

    const id = button.dataset.deleteTransaction;
    transactions = transactions.filter((item) => item.id !== id);

    saveData();
    renderAll();
    showToast("Transaction deleted.");
});

$("#goal-list").addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-savings]");
    const deleteButton = event.target.closest("[data-delete-goal]");

    if (addButton) {
        const goal = goals.find((item) => item.id === addButton.dataset.addSavings);
        if (!goal) return;

        const remaining = Number(goal.target) - Number(goal.saved);
        const response = prompt(`How much would you like to add to "${goal.name}"?\nRemaining: ${formatMoney(remaining)}`);

        if (response === null || response.trim() === "") return;

        const amount = Number(response);
        if (!Number.isFinite(amount) || amount <= 0) {
            showToast("Enter a valid positive amount.");
            return;
        }

        goal.saved = Math.round(Math.min(Number(goal.target), Number(goal.saved) + amount) * 100) / 100;
        saveData();
        renderGoals();
        showToast(goal.saved >= goal.target ? "Congratulations! Goal reached." : "Savings progress updated.");
    }

    if (deleteButton) {
        const id = deleteButton.dataset.deleteGoal;
        goals = goals.filter((item) => item.id !== id);
        saveData();
        renderGoals();
        showToast("Savings goal deleted.");
    }
});

document.querySelectorAll(".side-nav .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".side-nav .nav-link").forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
    });
});

$("#transaction-date").value = todayString();

renderAll();
