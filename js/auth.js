const API_BASE = 'api';

function normalizeLocalPath(value) {
    if (!value) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return value.replace(/^\/+/, '');
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

async function checkAuth() {
    try {
        const response = await fetchAPI('/auth/me');
        return response.data;
    } catch (error) {
        return null;
    }
}

async function login(email, password) {
    return fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

async function register(email, password, name) {
    return fetchAPI('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name })
    });
}

async function logout() {
    return fetchAPI('/auth/logout', {
        method: 'POST'
    });
}

async function updateProfile(name, surname, phone, avatar_url) {
    return fetchAPI('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, surname, phone, avatar_url })
    });
}


function initMobileMenu() {
    const headerNav = document.querySelector('.header__nav');
    const headerMenu = document.querySelector('.header__menu');
    if (!headerNav || !headerMenu) return;

    if (document.getElementById('mobile-menu')) return;

    const burgerBtn = document.createElement('button');
    burgerBtn.type = 'button';
    burgerBtn.className = 'header__burger';
    burgerBtn.setAttribute('aria-label', 'Открыть меню');
    burgerBtn.setAttribute('aria-controls', 'mobile-menu');
    burgerBtn.setAttribute('aria-expanded', 'false');
    burgerBtn.innerHTML = '<span class="header__burger-icon" aria-hidden="true"></span>';

    headerNav.appendChild(burgerBtn);

    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.id = 'mobile-menu';
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.innerHTML = `
        <div class="mobile-menu__overlay" data-mobile-menu-close></div>
        <div class="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Меню">
            <div class="mobile-menu__header">
                <div class="mobile-menu__title">Меню</div>
                <button class="mobile-menu__close" type="button" aria-label="Закрыть меню" data-mobile-menu-close>&times;</button>
            </div>
            <nav class="mobile-menu__nav" id="mobile-menu-nav"></nav>
            <div class="mobile-menu__auth" id="mobile-auth"></div>
        </div>
    `;

    const mobileNav = mobileMenu.querySelector('#mobile-menu-nav');
    headerMenu.querySelectorAll('a').forEach(link => {
        const mobileLink = document.createElement('a');
        mobileLink.href = link.getAttribute('href') || '#';
        mobileLink.textContent = link.textContent;
        mobileLink.className = 'mobile-menu__link';
        if (link.classList.contains('header__link--active')) {
            mobileLink.classList.add('mobile-menu__link--active');
        }
        mobileNav.appendChild(mobileLink);
    });

    document.body.appendChild(mobileMenu);

    let lastFocusedElement = null;

    const isOpen = () => mobileMenu.classList.contains('is-open');

    const openMenu = () => {
        if (isOpen()) return;
        lastFocusedElement = document.activeElement;
        mobileMenu.classList.add('is-open');
        mobileMenu.setAttribute('aria-hidden', 'false');
        burgerBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('mobile-menu-open');

        const closeBtn = mobileMenu.querySelector('.mobile-menu__close');
        if (closeBtn) closeBtn.focus();
    };

    const closeMenu = () => {
        if (!isOpen()) return;
        mobileMenu.classList.remove('is-open');
        mobileMenu.setAttribute('aria-hidden', 'true');
        burgerBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('mobile-menu-open');

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    };

    const toggleMenu = () => {
        if (isOpen()) closeMenu();
        else openMenu();
    };

    burgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMenu();
    });

    mobileMenu.querySelectorAll('[data-mobile-menu-close]').forEach(el => {
        el.addEventListener('click', closeMenu);
    });

    
    mobileMenu.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeMenu();
    });
}


async function updateHeader() {
    const headerAuth = document.getElementById('header-auth');
    const mobileAuth = document.getElementById('mobile-auth');
    if (!headerAuth && !mobileAuth) return;

    const user = await checkAuth();

    if (user) {
        
        let unreadCount = 0;
        try {
            const countResponse = await fetchAPI('/notifications/count');
            unreadCount = countResponse.data.count || 0;
        } catch (e) {
            console.error('Failed to fetch notifications count:', e);
        }

        const fullName = `${user.name}${user.surname ? ' ' + user.surname : ''}`;
        const avatarUrl = normalizeLocalPath(user.avatar_url) || 'images/default-avatar.svg';

        if (headerAuth) {
            headerAuth.innerHTML = `
                <div class="header__user-dropdown">
                    <a href="profile.html" class="header__user">
                        <img src="${avatarUrl}" alt="${fullName}" class="header__user-avatar">
                        <span class="header__user-name">${fullName}</span>
                    </a>
                    <div class="header__dropdown">
                        <button class="header__dropdown-item header__dropdown-notifications" id="notifications-btn">
                            <img src="images/bell.svg" alt="" class="header__dropdown-icon">
                            <span>Уведомления</span>
                            ${unreadCount > 0 ? `<span class="header__dropdown-badge">${unreadCount}</span>` : ''}
                        </button>
                        <button class="header__dropdown-item header__dropdown-logout" id="header-logout-btn">
                            <img src="images/log-out.svg" alt="" class="header__dropdown-icon">
                            <span>Выйти</span>
                        </button>
                    </div>
                    <div class="notifications-panel" id="notifications-panel" style="display: none;">
                        <div class="notifications-panel__header">
                            <span>Уведомления</span>
                            <button class="notifications-panel__mark-all" id="mark-all-read">Прочитать все</button>
                        </div>
                        <div class="notifications-panel__list" id="notifications-list">
                            <div class="notifications-panel__loading">Загрузка...</div>
                        </div>
                    </div>
                </div>
                ${user.role === 'admin' ? '<a href="admin.html" class="button button--secondary button--small">Админ</a>' : ''}
            `;
        }

        if (mobileAuth) {
            mobileAuth.innerHTML = `
                <a href="profile.html" class="mobile-auth__user">
                    <img src="${avatarUrl}" alt="${fullName}" class="mobile-auth__avatar">
                    <span class="mobile-auth__name">${fullName}</span>
                </a>
                <div class="mobile-auth__buttons">
                    <a href="profile.html" class="button button--secondary button--full">Профиль</a>
                    ${user.role === 'admin' ? '<a href="admin.html" class="button button--secondary button--full">Админ</a>' : ''}
                    <button class="button button--secondary button--full" id="mobile-logout-btn" type="button">Выйти</button>
                </div>
            `;
        }

        
        const desktopLogoutBtn = document.getElementById('header-logout-btn');
        if (desktopLogoutBtn) desktopLogoutBtn.addEventListener('click', handleHeaderLogout);

        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleHeaderLogout);

        
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) notificationsBtn.addEventListener('click', toggleNotificationsPanel);

        const markAllReadBtn = document.getElementById('mark-all-read');
        if (markAllReadBtn) markAllReadBtn.addEventListener('click', markAllNotificationsRead);

        
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notifications-panel');
            const btn = document.getElementById('notifications-btn');
            if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
                panel.style.display = 'none';
            }
        });
    } else {
        if (headerAuth) {
            headerAuth.innerHTML = `
                <a href="login.html" class="button button--secondary">Войти</a>
                <a href="register.html" class="button button--primary">Регистрация</a>
            `;
        }

        if (mobileAuth) {
            mobileAuth.innerHTML = `
                <a href="login.html" class="button button--secondary button--full">Войти</a>
                <a href="register.html" class="button button--primary button--full">Регистрация</a>
            `;
        }
    }

    
    if (headerAuth) headerAuth.classList.add('loaded');
    if (mobileAuth) mobileAuth.classList.add('loaded');
}

async function handleHeaderLogout() {
    try {
        await logout();
        showToast('Вы вышли из системы', 'success');
        window.location.href = './';
    } catch (error) {
        showToast('Ошибка при выходе', 'error');
    }
}

async function toggleNotificationsPanel(e) {
    e.stopPropagation();
    const panel = document.getElementById('notifications-panel');

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        await loadNotifications();
    } else {
        panel.style.display = 'none';
    }
}

async function loadNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    try {
        const response = await fetchAPI('/notifications');
        const notifications = response.data;

        if (notifications.length === 0) {
            list.innerHTML = '<div class="notifications-panel__empty">Нет уведомлений</div>';
            return;
        }

        list.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'notification-item--unread'}" data-id="${n.id}">
                <span class="notification-item__icon">${n.type === 'idea_approved' ? '✅' : '❌'}</span>
                <div class="notification-item__content">
                    <p class="notification-item__message">${escapeHtml(n.message)}</p>
                    <span class="notification-item__time">${formatDate(n.created_at)}</span>
                </div>
            </div>
        `).join('');

        
        list.querySelectorAll('.notification-item--unread').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                try {
                    await fetchAPI(`/notifications/${id}/read`, { method: 'PUT' });
                    item.classList.remove('notification-item--unread');
                    updateNotificationBadge();
                } catch (e) {
                    console.error('Failed to mark notification as read:', e);
                }
            });
        });
    } catch (error) {
        list.innerHTML = '<div class="notifications-panel__empty">Ошибка загрузки</div>';
    }
}

async function markAllNotificationsRead() {
    try {
        await fetchAPI('/notifications/read-all', { method: 'PUT' });
        document.querySelectorAll('.notification-item--unread').forEach(item => {
            item.classList.remove('notification-item--unread');
        });
        updateNotificationBadge();
        showToast('Все уведомления прочитаны', 'success');
    } catch (error) {
        showToast('Ошибка при обновлении уведомлений', 'error');
    }
}

async function updateNotificationBadge() {
    try {
        const response = await fetchAPI('/notifications/count');
        const badge = document.querySelector('.header__dropdown-badge');
        const count = response.data.count || 0;

        if (count > 0) {
            if (badge) {
                badge.textContent = count;
            } else {
                const btn = document.getElementById('notifications-btn');
                if (btn) {
                    const badgeEl = document.createElement('span');
                    badgeEl.className = 'header__dropdown-badge';
                    badgeEl.textContent = count;
                    btn.appendChild(badgeEl);
                }
            }
        } else {
            if (badge) badge.remove();
        }
    } catch (error) {
        console.error('Failed to update notification badge:', error);
    }
}


function initLoginPage() {
    updateHeader();

    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('submit-btn');
    const formError = document.getElementById('form-error');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Вход...';
        formError.style.display = 'none';

        try {
            await login(email, password);
            showToast('Добро пожаловать!', 'success');

            
            const redirect = new URLSearchParams(window.location.search).get('redirect');
            window.location.href = redirect || './';
        } catch (error) {
            formError.textContent = error.message;
            formError.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        }
    });
}


function initRegisterPage() {
    updateHeader();

    const form = document.getElementById('register-form');
    const submitBtn = document.getElementById('submit-btn');
    const formError = document.getElementById('form-error');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;

        if (password !== passwordConfirm) {
            formError.textContent = 'Пароли не совпадают';
            formError.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Регистрация...';
        formError.style.display = 'none';

        try {
            await register(email, password, name);
            showToast('Регистрация успешна! Теперь войдите в систему.', 'success');
            window.location.href = 'login.html';
        } catch (error) {
            formError.textContent = error.message;
            formError.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Зарегистрироваться';
        }
    });
}


async function initProfilePage() {
    const user = await checkAuth();

    if (!user) {
        window.location.href = 'login.html?redirect=profile.html';
        return;
    }

    updateHeader();

    
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('profile-tab--active'));
            tab.classList.add('profile-tab--active');

            
            document.querySelectorAll('.profile-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
        });
    });

    
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-surname').value = user.surname || '';
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('avatar-url').value = user.avatar_url !== 'images/default-avatar.svg' ? user.avatar_url : '';
    document.getElementById('profile-avatar').src = user.avatar_url || 'images/default-avatar.svg';

    
    document.getElementById('avatar-url').addEventListener('input', (e) => {
        const url = e.target.value;
        document.getElementById('profile-avatar').src = url || 'images/default-avatar.svg';
    });

    
    const form = document.getElementById('profile-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('profile-name').value;
        const surname = document.getElementById('profile-surname').value;
        const phone = document.getElementById('profile-phone').value;
        const avatarUrl = document.getElementById('avatar-url').value;

        try {
            const response = await updateProfile(name, surname, phone, avatarUrl);
            showToast('Профиль обновлён!', 'success');
            document.getElementById('profile-avatar').src = response.data.avatar_url;
            updateHeader();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    
    loadUserIdeas();
}

async function loadUserIdeas() {
    const ideasContainer = document.getElementById('user-ideas');
    const loading = document.getElementById('ideas-loading');
    const empty = document.getElementById('ideas-empty');

    try {
        const response = await fetchAPI('/user/ideas');

        if (loading) loading.style.display = 'none';

        
        const ideas = response.data;
        const stats = {
            total: ideas.length,
            pending: ideas.filter(i => i.status === 'pending').length,
            approved: ideas.filter(i => i.status === 'approved').length,
            rejected: ideas.filter(i => i.status === 'rejected').length
        };

        
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-pending').textContent = stats.pending;
        document.getElementById('stat-approved').textContent = stats.approved;
        document.getElementById('stat-rejected').textContent = stats.rejected;

        if (ideas.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }

        ideasContainer.innerHTML = ideas.map(idea => `
            <div class="profile-idea">
                <div class="profile-idea__status profile-idea__status--${idea.status}">
                    ${getStatusIcon(idea.status)} ${getStatusText(idea.status)}
                </div>
                <h3 class="profile-idea__title">${escapeHtml(idea.title)}</h3>
                <p class="profile-idea__category">${escapeHtml(idea.category)}</p>
                <div class="profile-idea__meta">
                    <span><img src="images/heart.svg" alt="" class="icon-inline"> ${idea.votes_count} голосов</span>
                    <span>${formatDate(idea.created_at)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        if (loading) loading.style.display = 'none';
        showToast('Ошибка при загрузке идей', 'error');
    }
}

function getStatusIcon(status) {
    const icons = {
        'pending': '⏳',
        'approved': '✅',
        'rejected': '❌',
        'implemented': '✓'
    };
    return icons[status] || '';
}


async function initAdminPage() {
    const user = await checkAuth();

    if (!user || user.role !== 'admin') {
        window.location.href = './';
        return;
    }

    updateHeader();

    
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('admin-tab--active'));
            tab.classList.add('admin-tab--active');
            loadAdminIdeas(tab.dataset.status);
        });
    });

    
    loadAdminIdeas('pending');
}

async function loadAdminIdeas(status = 'pending') {
    const container = document.getElementById('admin-ideas');
    const loading = document.getElementById('admin-loading');
    const empty = document.getElementById('admin-empty');

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    container.innerHTML = '';

    try {
        const response = await fetchAPI(`/admin/ideas?status=${status}`);

        if (loading) loading.style.display = 'none';

        if (response.data.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }

        container.innerHTML = response.data.map(idea => `
            <div class="admin-idea" data-id="${idea.id}">
                <div class="admin-idea__header">
                    <span class="admin-idea__category">${escapeHtml(idea.category)}</span>
                    <span class="admin-idea__status admin-idea__status--${idea.status}">${getStatusText(idea.status)}</span>
                </div>
                <h3 class="admin-idea__title">${escapeHtml(idea.title)}</h3>
                <p class="admin-idea__description">${escapeHtml(idea.description)}</p>
                <div class="admin-idea__meta">
                    <span>Автор: ${escapeHtml(idea.author_name || 'Неизвестно')} (${escapeHtml(idea.author_email || '')})</span>
                    <span>${formatDate(idea.created_at)}</span>
                </div>
                ${status === 'pending' ? `
                    <div class="admin-idea__actions">
                        <button class="button button--success" onclick="approveIdea(${idea.id})">✓ Опубликовать</button>
                        <button class="button button--danger" onclick="rejectIdea(${idea.id})">✕ Отклонить</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        if (loading) loading.style.display = 'none';
        showToast('Ошибка при загрузке идей', 'error');
    }
}

async function approveIdea(ideaId) {
    try {
        await fetchAPI(`/admin/ideas/${ideaId}/approve`, { method: 'PUT' });
        showToast('Идея опубликована!', 'success');
        loadAdminIdeas('pending');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function rejectIdea(ideaId) {
    try {
        await fetchAPI(`/admin/ideas/${ideaId}/reject`, { method: 'PUT' });
        showToast('Идея отклонена', 'success');
        loadAdminIdeas('pending');
    } catch (error) {
        showToast(error.message, 'error');
    }
}


function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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


document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    updateHeader();
});
