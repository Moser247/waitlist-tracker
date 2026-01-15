// GitHub raw URL for waitlist data
const DATA_URL = 'https://raw.githubusercontent.com/Moser247/waitlist-tracker/main/data/waitlist.json';

let waitlistData = null;

// Configuration
const CONFIG = {
    fetchTimeout: 10000,      // 10 second timeout
    maxRetries: 3,            // Retry up to 3 times
    debounceDelay: 300,       // 300ms debounce for search
};

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();

    // Set up search with debounce
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    searchBtn.addEventListener('click', search);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search();
    });

    // Debounced search on input
    searchInput.addEventListener('input', debounce(search, CONFIG.debounceDelay));
});

/**
 * Debounce function to limit how often a function is called
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.fetchTimeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response;

        } catch (error) {
            clearTimeout(timeoutId);

            const isLastAttempt = attempt === retries;
            const isAbortError = error.name === 'AbortError';

            if (isLastAttempt) {
                throw new Error(isAbortError ? 'Request timed out' : error.message);
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function loadData() {
    const loadingDiv = document.getElementById('loading');
    const summaryDiv = document.getElementById('summary');
    loadingDiv.style.display = 'block';

    try {
        // Cache bust with timestamp
        const response = await fetchWithRetry(DATA_URL + '?t=' + Date.now());
        waitlistData = await response.json();

        // Validate data structure
        if (!waitlistData || !waitlistData.waitlists) {
            throw new Error('Invalid data format');
        }

        // Update last updated time
        if (waitlistData.last_updated) {
            const date = new Date(waitlistData.last_updated);
            document.getElementById('lastUpdated').textContent = date.toLocaleString();
        }

        // Show summary
        showSummary();

        // Show all classes initially
        displayResults(Object.keys(waitlistData.waitlists));

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('lastUpdated').textContent = 'Unable to load';
        summaryDiv.innerHTML = `
            <div class="error">
                <p><strong>Unable to load waitlist data</strong></p>
                <p style="font-size: 0.9rem; margin-top: 8px;">
                    ${escapeHtml(error.message)}.
                    <a href="#" onclick="location.reload(); return false;">Try refreshing</a>
                </p>
            </div>
        `;
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

    if (query === '') {
        // Show all classes when search is empty
        displayResults(Object.keys(waitlistData.waitlists));
        return;
    }

    // Search for student names within waitlists
    const matchingStudents = [];

    for (const [className, entries] of Object.entries(waitlistData.waitlists)) {
        for (const entry of entries) {
            if (entry.name && entry.name.toLowerCase().includes(query)) {
                matchingStudents.push({
                    className: className,
                    position: entry.position,
                    name: entry.name
                });
            }
        }
    }

    displayStudentResults(matchingStudents, query);
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

function displayStudentResults(students, query) {
    const resultsDiv = document.getElementById('results');
    const noResultsDiv = document.getElementById('noResults');

    if (students.length === 0) {
        resultsDiv.innerHTML = '';
        noResultsDiv.style.display = 'block';
        return;
    }

    noResultsDiv.style.display = 'none';

    // Sort by position (lowest first)
    students.sort((a, b) => a.position - b.position);

    let html = '';
    for (const student of students) {
        // Color based on position
        let statusClass = 'status-low';
        if (student.position >= 10) {
            statusClass = 'status-high';
        } else if (student.position >= 5) {
            statusClass = 'status-medium';
        }

        html += `
            <div class="result-card ${statusClass}">
                <div class="class-name">${escapeHtml(student.name)}</div>
                <div class="waitlist-info">
                    <span class="count">#${student.position}</span>
                    <span class="label">on waitlist</span>
                </div>
                <div class="class-detail">${escapeHtml(student.className)}</div>
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
