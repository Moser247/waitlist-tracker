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
});

async function loadData() {
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
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('lastUpdated').textContent = 'Unable to load data';
    }
}

function search() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();

    if (!query) {
        return;
    }

    if (!waitlistData || !waitlistData.waitlists) {
        document.getElementById('results').innerHTML = '<p class="error">Data not loaded. Please refresh the page.</p>';
        return;
    }

    // Show loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').innerHTML = '';
    document.getElementById('noResults').style.display = 'none';

    // Simulate brief loading for UX
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';

        const results = [];

        // Search through all waitlists
        for (const [className, entries] of Object.entries(waitlistData.waitlists)) {
            for (const entry of entries) {
                const name = entry.name.toLowerCase();
                // Match if query is found anywhere in the name
                if (name.includes(query)) {
                    results.push({
                        className: className,
                        position: entry.position,
                        name: entry.name
                    });
                }
            }
        }

        displayResults(results);
    }, 300);
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    const noResultsDiv = document.getElementById('noResults');

    if (results.length === 0) {
        noResultsDiv.style.display = 'block';
        return;
    }

    // Sort by position
    results.sort((a, b) => a.position - b.position);

    let html = '';
    for (const result of results) {
        html += `
            <div class="result-card">
                <div class="class-name">${escapeHtml(result.className)}</div>
                <div class="position">
                    <div class="position-number">#${result.position}</div>
                    <div class="position-text">on the waitlist</div>
                </div>
                <div class="child-name">${escapeHtml(result.name)}</div>
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
