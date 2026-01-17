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

// Class type categories for grouping
const CLASS_CATEGORIES = [
    { key: '2s', match: /^2s\s*-/i, label: '2s (Talented 2s)' },
    { key: '3/4s', match: /^3\/4s\s*-/i, label: '3/4s (Tremendous 3s/Fabulous 4s)' },
    { key: 'BEGINNER', match: /^BEGINNER\s*\//i, label: 'Beginner' },
    { key: 'ADVANCED BEGINNER', match: /^ADVANCED BEGINNER\s*\//i, label: 'Advanced Beginner' },
    { key: 'INTERMEDIATE', match: /^INTERMEDIATE\s*\//i, label: 'Intermediate' },
    { key: 'ADVANCED', match: /^ADVANCED\s*\//i, label: 'Advanced' },
    { key: 'MASTER', match: /^MASTER\s*\//i, label: 'Master' },
    { key: 'BOYS BEGINNER', match: /^BOYS BEGINNER\s*\//i, label: 'Boys Beginner' },
    { key: 'HOME SCHOOL', match: /^HOME SCHOOL\s*\//i, label: 'Home School' },
    { key: 'NINJA ZONE WHITE', match: /^NINJA ZONE WHITE\s*\//i, label: 'Ninja Zone White' },
    { key: 'NINJA ZONE YELLOW', match: /^NINJA ZONE YELLOW/i, label: 'Ninja Zone Yellow/Green' },
    { key: 'NZ - LIL NINJA', match: /^NZ\s*-\s*LIL NINJA/i, label: 'NZ - Lil Ninja' },
    { key: 'REC TEAM', match: /^REC TEAM/i, label: 'Rec Team' },
    { key: 'BEGINNER / ADVANCED BEGINNER', match: /^BEGINNER\s*\/\s*ADVANCED BEGINNER/i, label: 'Beginner/Adv Beginner Combo' },
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
 * Get the category for a class name
 */
function getClassCategory(className) {
    // Check longer/more specific matches first (BEGINNER / ADVANCED BEGINNER before BEGINNER)
    const sortedCategories = [...CLASS_CATEGORIES].sort((a, b) => b.key.length - a.key.length);

    for (const category of sortedCategories) {
        if (category.match.test(className)) {
            return category;
        }
    }
    return null;
}

/**
 * Get unique class categories from waitlist data
 */
function getUniqueCategories() {
    if (!waitlistData || !waitlistData.waitlists) return [];

    const foundCategories = new Set();

    for (const className of Object.keys(waitlistData.waitlists)) {
        const category = getClassCategory(className);
        if (category) {
            foundCategories.add(category.key);
        }
    }

    // Return categories in the defined order, only those that exist in the data
    return CLASS_CATEGORIES.filter(cat => foundCategories.has(cat.key));
}

/**
 * Populate the class filter dropdown
 */
function populateClassFilter() {
    const classFilter = document.getElementById('classFilter');
    const categories = getUniqueCategories();

    // Clear existing options (except "All Classes")
    classFilter.innerHTML = '<option value="">All Classes</option>';

    for (const category of categories) {
        const option = document.createElement('option');
        option.value = category.key;
        option.textContent = category.label;
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

    // Find the category for the current filter
    const filterCategory = CLASS_CATEGORIES.find(cat => cat.key === currentFilter);
    if (!filterCategory) {
        return allClasses;
    }

    return allClasses.filter(className => filterCategory.match.test(className));
}

async function loadData() {
    const loadingDiv = document.getElementById('loading');
    const summaryDiv = document.getElementById('summary');
    loadingDiv.style.display = 'block';

    try {
        const response = await fetchWithRetry(DATA_URL);
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

    const summaryDiv = document.getElementById('summary');

    // Get the friendly label for the current filter
    let filterLabel = '';
    if (currentFilter) {
        const category = CLASS_CATEGORIES.find(cat => cat.key === currentFilter);
        filterLabel = category ? ` (${category.label})` : ` (${currentFilter})`;
    }

    const filteredClasses = getFilteredClasses();
    const totalClasses = filteredClasses.length;
    const totalWaiting = filteredClasses
        .reduce((sum, className) => sum + (waitlistData.waitlists[className]?.length || 0), 0);

    summaryDiv.innerHTML = `
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

/**
 * Check if a name matches the search query
 * Handles "Last, First" format and searches for all words
 */
function nameMatchesQuery(name, query) {
    const nameLower = name.toLowerCase();

    // Split query into individual words
    const queryWords = query.split(/\s+/).filter(word => word.length > 0);

    if (queryWords.length === 0) return false;

    // For single word queries, just check if the name contains it
    if (queryWords.length === 1) {
        return nameLower.includes(queryWords[0]);
    }

    // For multi-word queries, check if ALL words are found in the name
    // This handles both "reagan johnson" and "johnson reagan" matching "Johnson, Reagan"
    return queryWords.every(word => nameLower.includes(word));
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
            if (entry.name && nameMatchesQuery(entry.name, query)) {
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
    const expandHint = document.getElementById('expandHint');

    if (classNames.length === 0) {
        resultsDiv.innerHTML = '';
        noResultsDiv.style.display = 'block';
        if (expandHint) expandHint.style.display = 'none';
        noResultsDiv.querySelector('p').textContent = currentFilter
            ? `No classes found for "${currentFilter}".`
            : 'No classes found.';
        return;
    }

    noResultsDiv.style.display = 'none';
    if (expandHint) expandHint.style.display = 'block';

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

        // Build the waitlist details HTML
        let detailsHtml = '<ul>';
        for (const entry of entries) {
            detailsHtml += `
                <li>
                    <span class="position">${entry.position}</span>
                    <span class="student-name">${escapeHtml(entry.name)}</span>
                </li>
            `;
        }
        detailsHtml += '</ul>';

        html += `
            <div class="result-card expandable ${statusClass}" data-class="${escapeHtml(className)}">
                <div class="class-name">${escapeHtml(className)}</div>
                <div class="waitlist-info">
                    <span class="count">${waitingCount}</span>
                    <span class="label">people waiting</span>
                </div>
                <div class="waitlist-details">
                    ${detailsHtml}
                </div>
            </div>
        `;
    }

    resultsDiv.innerHTML = html;

    // Add click handlers for expandable cards
    document.querySelectorAll('.result-card.expandable').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });
    });
}

function displayStudentResults(students, query) {
    const resultsDiv = document.getElementById('results');
    const noResultsDiv = document.getElementById('noResults');
    const expandHint = document.getElementById('expandHint');

    // Hide expand hint when showing student results
    if (expandHint) expandHint.style.display = 'none';

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
