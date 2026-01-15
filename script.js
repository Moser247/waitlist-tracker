// GitHub raw URL for waitlist data
const DATA_URL = 'https://raw.githubusercontent.com/Moser247/waitlist-tracker/main/data/waitlist.json';

let waitlistData = null;
let currentFilter = '';

// Configuration
const CONFIG = {
    fetchTimeout: 10000,      // 10 second timeout
    maxRetries: 3,            // Retry up to 3 times
    debounceDelay: 300,       // 300ms debounce for search
};

// Class type mappings for better display names
const CLASS_TYPE_ORDER = [
    '2s',
    '3/4s',
    'BEGINNER',
    'ADVANCED BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'MASTER',
    'BOYS BEGINNER',
    'HOME SCHOOL',
    'NINJA ZONE WHITE',
    'NINJA ZONE YELLOW',
    'NZ - LIL NINJA',
    'REC TEAM'
];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();

    // Set up search with debounce
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const classFilter = document.getElementById('classFilter');

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Debounced search on input
    searchInput.addEventListener('input', debounce(performSearch, CONFIG.debounceDelay));

    // Class filter change
    classFilter.addEventListener('change', () => {
        currentFilter = classFilter.value;
        performSearch();
    });
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

/**
 * Extract class type from class name
 */
function getClassType(className) {
    // Extract the prefix before the first " / " which indicates day/time
    const parts = className.split(' / ');
    if (parts.length > 1) {
        return parts[0].trim();
    }
    return className;
}

/**
 * Get unique class types from waitlist data
 */
function getUniqueClassTypes() {
    if (!waitlistData || !waitlistData.waitlists) return [];

    const types = new Set();
    for (const className of Object.keys(waitlistData.waitlists)) {
        const type = getClassType(className);
        types.add(type);
    }

    // Sort by predefined order, then alphabetically for any not in the list
    return Array.from(types).sort((a, b) => {
        const aIndex = CLASS_TYPE_ORDER.findIndex(t => a.startsWith(t));
        const bIndex = CLASS_TYPE_ORDER.findIndex(t => b.startsWith(t));

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });
}

/**
 * Populate the class filter dropdown
 */
function populateClassFilter() {
    const classFilter = document.getElementById('classFilter');
    const types = getUniqueClassTypes();

    // Clear existing options (except "All Classes")
    classFilter.innerHTML = '<option value="">All Classes</option>';

    for (const type of types) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        classFilter.appendChild(option);
    }
}

/**
 * Get classes that match the current filter
 */
function getFilteredClasses() {
    if (!waitlistData || !waitlistData.waitlists) return [];

    const allClasses = Object.keys(waitlistData.waitlists);

    if (!currentFilter) {
        return allClasses;
    }

    return allClasses.filter(className => {
        const type = getClassType(className);
        return type === currentFilter;
    });
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

        // Populate class filter dropdown
        populateClassFilter();

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

    const filteredClasses = getFilteredClasses();
    const totalClasses = filteredClasses.length;
    const totalWaiting = filteredClasses
        .reduce((sum, className) => sum + (waitlistData.waitlists[className]?.length || 0), 0);

    const filterLabel = currentFilter ? ` (${currentFilter})` : '';

    document.getElementById('summary').innerHTML = `
        <div class="summary-box">
            <div class="stat">
                <span class="number">${totalClasses}</span>
                <span class="label">Classes with waitlists${filterLabel}</span>
            </div>
            <div class="stat">
                <span class="number">${totalWaiting}</span>
                <span class="label">Total people waiting</span>
            </div>
        </div>
    `;
}

function performSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();

    if (!waitlistData || !waitlistData.waitlists) {
        document.getElementById('results').innerHTML = '<p class="error">Data not loaded. Please refresh the page.</p>';
        return;
    }

    // Update summary based on filter
    showSummary();

    // Get filtered classes
    const filteredClasses = getFilteredClasses();

    if (query === '') {
        // Show filtered classes when search is empty
        displayResults(filteredClasses);
        return;
    }

    // Search for student names within filtered waitlists
    const matchingStudents = [];

    for (const className of filteredClasses) {
        const entries = waitlistData.waitlists[className] || [];
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
        noResultsDiv.querySelector('p').textContent = currentFilter
            ? `No classes found for "${currentFilter}".`
            : 'No classes found.';
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
        noResultsDiv.querySelector('p').textContent = currentFilter
            ? `No students found matching "${query}" in ${currentFilter} classes.`
            : `No students found matching "${query}".`;
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
