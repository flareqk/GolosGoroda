







async function fetchAPI(endpoint, options = {}) {
    const headers = {
        ...options.headers
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Произошла ошибка');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}


function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}


function showAuthModal() {
    
    if (document.getElementById('auth-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal__overlay"></div>
        <div class="modal__content">
            <button class="modal__close" onclick="closeAuthModal()">&times;</button>
            <div class="modal__icon">🔐</div>
            <h2 class="modal__title">Требуется авторизация</h2>
            <p class="modal__text">Для голосования и подачи идей необходимо войти в систему</p>
            <div class="modal__actions">
                <a href="login.html" class="button button--primary">Войти</a>
                <a href="register.html" class="button button--secondary">Зарегистрироваться</a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    
    modal.querySelector('.modal__overlay').addEventListener('click', closeAuthModal);
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.remove();
}


function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'На модерации',
        'approved': 'Опубликовано',
        'rejected': 'Отклонено',
        'implemented': 'Реализовано'
    };
    return statusMap[status] || status;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


async function loadStats() {
    try {
        const response = await fetchAPI('/stats');
        if (response.success) {
            const stats = response.data;

            const statTotal = document.getElementById('stat-total');
            const statVoting = document.getElementById('stat-voting');
            const statImplemented = document.getElementById('stat-implemented');
            const statVotes = document.getElementById('stat-votes');

            if (statTotal) animateNumber(statTotal, stats.totalIdeas);
            if (statVoting) animateNumber(statVoting, stats.activeVoting);
            if (statImplemented) animateNumber(statImplemented, stats.implemented);
            if (statVotes) animateNumber(statVotes, stats.totalVotes);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function animateNumber(element, target) {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); 
        const current = Math.round(start + (target - start) * easeProgress);

        element.textContent = current.toLocaleString('ru-RU');

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}


async function loadIdeas(filters = {}, limit = null) {
    const ideasGrid = document.getElementById('ideas-grid');
    const loading = document.getElementById('ideas-loading');
    const empty = document.getElementById('ideas-empty');

    if (!ideasGrid) return;

    
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    ideasGrid.innerHTML = '';

    try {
        let queryParams = new URLSearchParams();
        if (filters.category) queryParams.append('category', filters.category);
        if (filters.sort) queryParams.append('sort', filters.sort);
        if (filters.status) queryParams.append('status', filters.status);

        const response = await fetchAPI(`/ideas?${queryParams.toString()}`);

        if (loading) loading.style.display = 'none';

        if (response.success && response.data.length > 0) {
            let ideas = response.data;
            
            if (limit && limit > 0) {
                ideas = ideas.slice(0, limit);
            }
            ideas.forEach(idea => {
                const card = createIdeaCard(idea);
                ideasGrid.appendChild(card);
            });
        } else {
            if (empty) empty.style.display = 'block';
        }
    } catch (error) {
        if (loading) loading.style.display = 'none';
        showToast('Не удалось загрузить идеи', 'error');
    }
}


async function loadTopIdeas(limit = 6) {
    await loadIdeas({ sort: 'votes' }, limit);
}

function createIdeaCard(idea) {
    const card = document.createElement('article');
    card.className = 'idea-card';
    card.dataset.id = idea.id;

    const isApproved = idea.status === 'approved';

    card.innerHTML = `
        <div class="idea-card__header">
            <span class="idea-card__category">${escapeHtml(idea.category)}</span>
            ${idea.author_name ? `<span class="idea-card__author"><img src="images/user.svg" alt="" class="icon-inline"> ${escapeHtml(idea.author_name)}</span>` : ''}
        </div>
        <h3 class="idea-card__title">${escapeHtml(idea.title)}</h3>
        <p class="idea-card__description">${escapeHtml(idea.description)}</p>
        <div class="idea-card__footer">
            <div class="idea-card__votes">
                <img src="images/heart.svg" alt="" class="idea-card__votes-icon">
                <span class="idea-card__votes-count">${idea.votes_count}</span>
                <span>голосов</span>
            </div>
            ${isApproved ? `
                <button 
                    class="button button--primary idea-card__vote-btn ${idea.hasVoted ? 'idea-card__vote-btn--voted' : ''}"
                    data-idea-id="${idea.id}"
                    ${idea.hasVoted ? 'disabled' : ''}
                >
                    ${idea.hasVoted ? '✓ Вы поддержали' : 'Поддержать'}
                </button>
            ` : ''}
        </div>
    `;

    
    const voteBtn = card.querySelector('.idea-card__vote-btn');
    if (voteBtn && !idea.hasVoted) {
        voteBtn.addEventListener('click', () => handleVote(idea.id, card));
    }

    return card;
}


async function handleVote(ideaId, cardElement) {
    const voteBtn = cardElement.querySelector('.idea-card__vote-btn');
    const votesCount = cardElement.querySelector('.idea-card__votes-count');

    if (!voteBtn) return;

    
    voteBtn.disabled = true;
    voteBtn.textContent = 'Подождите...';

    try {
        const response = await fetchAPI('/vote', {
            method: 'POST',
            body: JSON.stringify({ ideaId })
        });

        if (response.success) {
            
            votesCount.textContent = response.data.votesCount;
            voteBtn.textContent = '✓ Вы поддержали';
            voteBtn.classList.add('idea-card__vote-btn--voted');

            showToast('Ваш голос учтён!', 'success');
        }
    } catch (error) {
        
        if (error.message.includes('авторизация')) {
            showAuthModal();
        } else {
            showToast(error.message || 'Не удалось проголосовать', 'error');
        }
        voteBtn.disabled = false;
        voteBtn.textContent = 'Поддержать';
    }
}


async function loadCategories() {
    try {
        const response = await fetchAPI('/categories');
        if (response.success) {
            return response.data;
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
    return [];
}

async function populateCategoryFilters() {
    const categories = await loadCategories();

    
    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            filterCategory.appendChild(option);
        });
    }

    
    const formCategory = document.getElementById('category');
    if (formCategory) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            formCategory.appendChild(option);
        });
    }
}


function setupFilters() {
    const categoryFilter = document.getElementById('filter-category');
    const sortFilter = document.getElementById('filter-sort');

    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }

    if (sortFilter) {
        sortFilter.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const category = document.getElementById('filter-category')?.value || '';
    const sort = document.getElementById('filter-sort')?.value || 'newest';

    loadIdeas({ category, sort });
}


async function initSubmitPage() {
    
    const user = await checkAuth();
    if (!user) {
        showAuthModal();
    }

    populateCategoryFilters();
    setupFileUpload();
    setupFormSubmit();
}

function setupFileUpload() {
    const fileInput = document.getElementById('file');
    const fileLabel = document.getElementById('file-label');

    if (!fileInput || !fileLabel) return;

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            const fileName = fileInput.files[0].name;
            fileLabel.innerHTML = `
                <span class="form__file-icon">📄</span>
                <span class="form__file-text">${escapeHtml(fileName)}</span>
            `;
            fileLabel.classList.add('form__file-label--active');
        }
    });

    
    fileLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileLabel.classList.add('form__file-label--active');
    });

    fileLabel.addEventListener('dragleave', () => {
        if (!fileInput.files.length) {
            fileLabel.classList.remove('form__file-label--active');
        }
    });

    fileLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            const fileName = e.dataTransfer.files[0].name;
            fileLabel.innerHTML = `
                <span class="form__file-icon">📄</span>
                <span class="form__file-text">${escapeHtml(fileName)}</span>
            `;
        }
    });
}

function setupFormSubmit() {
    const form = document.getElementById('idea-form');
    const submitBtn = document.getElementById('submit-btn');
    const successBlock = document.getElementById('submit-success');
    const submitAnother = document.getElementById('submit-another');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!form.checkValidity()) {
            showToast('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
            const formData = new FormData(form);

            const response = await fetch(`${API_BASE}/ideas`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                form.style.display = 'none';
                successBlock.style.display = 'block';
                showToast('Идея успешно отправлена!', 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            if (error.message.includes('авторизация')) {
                showAuthModal();
            } else {
                showToast(error.message || 'Не удалось отправить идею', 'error');
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить на модерацию';
        }
    });

    if (submitAnother) {
        submitAnother.addEventListener('click', () => {
            form.reset();
            form.style.display = 'block';
            successBlock.style.display = 'none';

            
            const fileLabel = document.getElementById('file-label');
            if (fileLabel) {
                fileLabel.innerHTML = `
                    <span class="form__file-icon">📎</span>
                    <span class="form__file-text">Выберите файл или перетащите сюда</span>
                `;
                fileLabel.classList.remove('form__file-label--active');
            }
        });
    }
}


function initResultsPage() {
    loadImplementedIdeas();
}

async function loadImplementedIdeas() {
    const resultsGrid = document.getElementById('results-grid');
    const loading = document.getElementById('results-loading');
    const empty = document.getElementById('results-empty');
    const resultsCount = document.getElementById('results-count');
    const resultsVotes = document.getElementById('results-votes');

    if (!resultsGrid) return;

    
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    resultsGrid.innerHTML = '';

    try {
        
        const response = await fetchAPI('/ideas?status=implemented&sort=votes');

        if (loading) loading.style.display = 'none';

        if (response.success && response.data.length > 0) {
            
            if (resultsCount) {
                animateNumber(resultsCount, response.data.length);
            }

            const totalVotes = response.data.reduce((sum, idea) => sum + idea.votes_count, 0);
            if (resultsVotes) {
                animateNumber(resultsVotes, totalVotes);
            }

            
            response.data.forEach(idea => {
                const card = createResultCard(idea);
                resultsGrid.appendChild(card);
            });
        } else {
            if (empty) empty.style.display = 'block';
        }
    } catch (error) {
        if (loading) loading.style.display = 'none';
        showToast('Не удалось загрузить идеи', 'error');
    }
}

function createResultCard(idea) {
    const card = document.createElement('article');
    card.className = 'idea-card';

    card.innerHTML = `
        <div class="idea-card__header">
            <span class="idea-card__category">${escapeHtml(idea.category)}</span>
            <span class="idea-card__status idea-card__status--implemented">✓ Реализовано</span>
        </div>
        <h3 class="idea-card__title">${escapeHtml(idea.title)}</h3>
        <p class="idea-card__description">${escapeHtml(idea.description)}</p>
        <div class="idea-card__footer">
            <div class="idea-card__votes">
                <img src="images/heart.svg" alt="" class="idea-card__votes-icon">
                <span>${idea.votes_count}</span>
                <span>голосов</span>
            </div>
            <span class="idea-card__date">${formatDate(idea.created_at)}</span>
        </div>
    `;

    return card;
}


document.addEventListener('DOMContentLoaded', () => {
    
    const pathname = window.location.pathname;
    const isHomePage = pathname.endsWith('/') || pathname.endsWith('/index.html');
    const hasIdeasGrid = document.getElementById('ideas-grid') !== null;
    const isSubmitPage = document.getElementById('idea-form') !== null;
    const isResultsPage = document.getElementById('results-grid') !== null;
    const hasFilters = document.getElementById('filter-category') !== null;

    if (isHomePage && hasIdeasGrid && !isSubmitPage && !isResultsPage) {
        
        loadStats();
        loadTopIdeas(6);
    }
});
