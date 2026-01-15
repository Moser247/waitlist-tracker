// GitHub raw URL for waitlist data
const DATA_URL = 'https://raw.githubusercontent.com/Moser247/waitlist-tracker/main/data/waitlist.json';

let waitlistData = null;

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();

    // Set up search
    document.getElementById('searchBtn').addEventListener('click', search);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search();
    });

    // Also filter as user types
    document.getElementById('searchInput').addEventListener('input', search);
});

async function loadData() {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = 'block';

    try {
        const response = await fetch(DATA_URL + '?t=' + Date.now()); // Cache bust
        if (!response.ok) {
            throw new Error('Data not available');
        }
        waitlistData = await response.json();

        // Update last updated time
        if (waitlistData.last_updated) {
            const date = new Date(waitlistData.last_updated);
            document.getElementById('lastUpdated').textContent = date.toLocaleString();
        }

        // Show summary
        showSummary();

        // Show all classes initially
        displayResults(Object.keys(waitlistData.waitlists || {}));

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('lastUpdated').textContent = 'Unable to load data';
        document.getElementById('summary').innerHTML = '<p class="error">Unable to load waitlist data. Please refresh the page.</p>';
    }

    loadingDiv.style.display = 'none';
}

function showSummary() {
    if (!waitlistData || !waitlistData.waitlists) return;

    const totalClasses = Object.keys(waitlistData.waitlists).length;
    const totalWaiting = Object.values(waitlistData.waitlists)
        .reduce((sum, entries) => sum + entries.length, 0);

    document.getElementById('summary').innerHTML = `
        <div class="summary-box">
            <div class="stat">
                <span class="number">${totalClasses}</span>
                <span class="label">Classes with waitlists</span>
            </div>
            <div class="stat">
                <span class="number">${totalWaiting}</span>
                <span class="label">Total people waiting</span>
            </div>
        </div>
    `;
}

function search() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();

    if (!waitlistData || !waitlistData.waitlists) {
        document.getElementById('results').innerHTML = '<p class="error">Data not loaded. Please refresh the page.</p>';
        return;
    }

    // Filter class names that match the query
    const matchingClasses = Object.keys(waitlistData.waitlists).filter(className =>
        className.toLowerCase().includes(query)
    );

    displayResults(matchingClasses);
}

function displayResults(classNames) {
    const resultsDiv = document.getElementById('results');
    const noResultsDiv = document.getElementById('noResults');

    if (classNames.length === 0) {
        resultsDiv.innerHTML = '';
        noResultsDiv.style.display = 'block';
        return;
    }

    noResultsDiv.style.display = 'none';

    // Sort by waitlist size (largest first)
    classNames.sort((a, b) => {
        const aCount = waitlistData.waitlists[a]?.length || 0;
        const bCount = waitlistData.waitlists[b]?.length || 0;
        return bCount - aCount;
    });

    let html = '';
    for (const className of classNames) {
        const entries = waitlistData.waitlists[className] || [];
        const waitingCount = entries.length;

        // Color based on waitlist size
        let statusClass = 'status-low';
        if (waitingCount >= 15) {
            statusClass = 'status-high';
        } else if (waitingCount >= 8) {
            statusClass = 'status-medium';
        }

        html += `
            <div class="result-card ${statusClass}">
                <div class="class-name">${escapeHtml(className)}</div>
                <div class="waitlist-info">
                    <span class="count">${waitingCount}</span>
                    <span class="label">people waiting</span>
                </div>
            </div>
        `;
    }

    resultsDiv.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
