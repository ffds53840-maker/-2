// Глобальные переменные
let currentUserId = null;
let currentPostId = null;
let ws = null;
let selectedUsers = [];

// ============= НАСТРОЙКИ СЕРВЕРА =============
// ЗАМЕНИТЕ НА ВАШ URL ИЗ xTunnel!
const SERVER_URL = 'https://random-name.xtunnel.ru'; // Сюда вставьте ваш URL
const WS_URL = SERVER_URL.replace('http', 'ws');

// Проверка авторизации при загрузке
checkAuth();

async function checkAuth() {
    try {
        const response = await fetch(`${SERVER_URL}/api/current-user`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.user && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        } else if (data.user) {
            currentUserId = data.user.id;
            console.log('Текущий пользователь:', data.user);
            connectWebSocket();
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// WebSocket подключение
function connectWebSocket() {
    if (!currentUserId) return;
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('WebSocket подключен');
        ws.send(JSON.stringify({
            type: 'auth',
            userId: currentUserId
        }));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
            if (window.location.pathname.includes('chat.html')) {
                const urlParams = new URLSearchParams(window.location.search);
                const currentChatId = urlParams.get('id');
                if (currentChatId === data.chatId) {
                    addMessageToChat(data.message);
                }
            }
            showNotification('Новое сообщение', 'info');
        }
        
        if (data.type === 'user_status') {
            updateUserStatus(data.userId, data.status, data.lastSeen);
        }
        
        if (data.type === 'typing') {
            if (window.location.pathname.includes('chat.html')) {
                const urlParams = new URLSearchParams(window.location.search);
                const currentChatId = urlParams.get('id');
                if (currentChatId === data.chatId) {
                    showTypingIndicator(data.userId);
                }
            }
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket отключен');
        setTimeout(connectWebSocket, 3000);
    };
}

// ============= ПОИСК =============
function toggleSearch() {
    const container = document.getElementById('searchContainer');
    if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
        if (container.style.display === 'block') {
            document.getElementById('searchInput')?.focus();
        }
    }
}

async function searchUsers() {
    const query = document.getElementById('searchInput')?.value;
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query || query.length < 2) {
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
            resultsDiv.classList.remove('show');
        }
        return;
    }
    
    try {
        const response = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });
        const results = await response.json();
        
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
            resultsDiv.classList.add('show');
            
            if (results.users.length === 0 && results.hashtags.length === 0 && results.posts.length === 0) {
                resultsDiv.innerHTML = '<div class="search-result-item">Ничего не найдено</div>';
                return;
            }
            
            // Пользователи
            if (results.users.length > 0) {
                const userSection = document.createElement('div');
                userSection.className = 'search-section';
                userSection.innerHTML = '<h4>Пользователи</h4>';
                results.users.forEach(user => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <img src="${user.avatar || 'https://via.placeholder.com/40'}" alt="">
                        <div style="flex:1">
                            <strong>${user.name}</strong>
                            <div>@${user.username}</div>
                            <div class="user-status ${user.isOnline ? 'online' : 'offline'}" data-user-id="${user.id}"></div>
                        </div>
                        <div class="search-actions">
                            <i class="fas fa-plus-circle" onclick="event.stopPropagation(); startChat('${user.id}')" title="Написать"></i>
                            <i class="fas fa-user-plus" onclick="event.stopPropagation(); quickFollow('${user.id}')" title="Подписаться"></i>
                        </div>
                    `;
                    div.onclick = () => window.location.href = `profile.html?user=${user.id}`;
                    userSection.appendChild(div);
                });
                resultsDiv.appendChild(userSection);
            }
            
            // Хештеги
            if (results.hashtags && results.hashtags.length > 0) {
                const tagSection = document.createElement('div');
                tagSection.className = 'search-section';
                tagSection.innerHTML = '<h4>Хештеги</h4>';
                results.hashtags.forEach(tag => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <i class="fas fa-hashtag" style="font-size:24px; color:#3b82f6;"></i>
                        <div>
                            <strong>${tag}</strong>
                        </div>
                    `;
                    div.onclick = () => window.location.href = `/?tag=${tag.replace('#', '')}`;
                    tagSection.appendChild(div);
                });
                resultsDiv.appendChild(tagSection);
            }
            
            // Посты
            if (results.posts && results.posts.length > 0) {
                const postSection = document.createElement('div');
                postSection.className = 'search-section';
                postSection.innerHTML = '<h4>Посты</h4>';
                results.posts.forEach(post => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        ${post.mediaUrl ? `<img src="${post.mediaUrl}" style="width:40px; height:40px; object-fit:cover;">` : '<i class="fas fa-file-alt" style="font-size:24px; color:#888;"></i>'}
                        <div>
                            <strong>${post.title || 'Без заголовка'}</strong>
                            <div>${post.content.substring(0, 50)}...</div>
                        </div>
                    `;
                    div.onclick = () => window.location.href = `/?post=${post.id}`;
                    postSection.appendChild(div);
                });
                resultsDiv.appendChild(postSection);
            }
        }
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

// ============= ПОСТЫ =============
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    document.addEventListener('DOMContentLoaded', loadPosts);
}

async function loadPosts() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const hashtag = urlParams.get('tag');
        const postId = urlParams.get('post');
        
        let url = `${SERVER_URL}/api/posts`;
        if (hashtag) {
            url += `?hashtag=${hashtag}`;
            const input = document.getElementById('hashtagInput');
            if (input) input.value = '#' + hashtag;
        }
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        const posts = await response.json();
        
        const container = document.getElementById('posts-container');
        if (!container) return;
        
        if (posts.length === 0) {
            container.innerHTML = '<div class="no-posts">Пока нет постов. Будьте первым! ⚡️</div>';
            return;
        }
        
        container.innerHTML = '';
        posts.forEach(post => {
            container.appendChild(createPostElement(post));
        });
        
        if (postId) {
            setTimeout(() => {
                const postElement = document.getElementById(`post-${postId}`);
                if (postElement) {
                    postElement.scrollIntoView({ behavior: 'smooth' });
                    postElement.style.border = '2px solid #3b82f6';
                }
            }, 500);
        }
    } catch (error) {
        console.error('Ошибка загрузки постов:', error);
    }
}

function filterByHashtag() {
    const input = document.getElementById('hashtagInput');
    if (!input) return;
    
    const hashtag = input.value.replace('#', '').trim();
    
    if (hashtag) {
        window.location.href = `/?tag=${hashtag}`;
    } else {
        window.location.href = '/';
    }
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.id = `post-${post.id}`;
    
    const isLiked = post.isLiked;
    const postDate = new Date(post.createdAt);
    const timeString = formatDate(postDate);
    
    // Хештеги
    let hashtagsHtml = '';
    if (post.hashtags && post.hashtags.length > 0) {
        hashtagsHtml = '<div class="post-hashtags">';
        post.hashtags.forEach(tag => {
            hashtagsHtml += `<span onclick="window.location.href='/?tag=${tag.replace('#', '')}'">${tag}</span> `;
        });
        hashtagsHtml += '</div>';
    }
    
    // Медиа
    let mediaHtml = '';
    if (post.mediaUrl) {
        if (post.mediaType === 'video') {
            mediaHtml = `
                <div class="post-image">
                    <video controls class="post-video" preload="metadata">
                        <source src="${post.mediaUrl}" type="video/mp4">
                        Ваш браузер не поддерживает видео.
                    </video>
                </div>
            `;
        } else {
            mediaHtml = `
                <div class="post-image">
                    <img src="${post.mediaUrl}" alt="Post media" loading="lazy" onclick="openImage('${post.mediaUrl}')">
                </div>
            `;
        }
    }
    
    // Заголовок
    const titleHtml = post.title ? `<h3 class="post-title">⚡️ ${post.title}</h3>` : '';
    
    // Комментарии
    let commentsHtml = '';
    if (post.comments && post.comments.length > 0) {
        commentsHtml = '<div class="post-comments-list">';
        post.comments.slice(-2).forEach(comment => {
            commentsHtml += `
                <div class="comment-preview" onclick="openComments('${post.id}')">
                    <strong>${comment.username}:</strong> ${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}
                </div>
            `;
        });
        if (post.comments.length > 2) {
            commentsHtml += `<div class="more-comments" onclick="openComments('${post.id}')">+${post.comments.length - 2} комментариев</div>`;
        }
        commentsHtml += '</div>';
    }
    
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-avatar" onclick="goToProfile('${post.userId}')">
                <img src="${post.userAvatar || 'https://via.placeholder.com/40'}" alt="${post.username}" loading="lazy">
                <div class="user-status ${post.isOnline ? 'online' : 'offline'}" data-user-id="${post.userId}"></div>
            </div>
            <div class="post-user">
                <strong onclick="goToProfile('${post.userId}')">${post.userName || post.username}</strong>
                ${post.userCountry ? `<span class="user-country-badge">${post.userCountry}</span>` : ''}
                <span>• ${timeString}</span>
                ${post.edited ? '<span style="color:#888; font-size:10px;"> (ред.)</span>' : ''}
            </div>
            ${post.userId === currentUserId ? `
                <i class="fas fa-edit" onclick="openEditPost('${post.id}', '${post.title?.replace(/'/g, "\\'")}', '${post.content?.replace(/'/g, "\\'")}')" style="color:#3b82f6; cursor:pointer; margin-right:10px;"></i>
                <i class="fas fa-trash" onclick="deletePost('${post.id}')" style="color:#ff4444; cursor:pointer;"></i>
            ` : ''}
        </div>
        ${titleHtml}
        <div class="post-content">${post.content}</div>
        ${hashtagsHtml}
        ${mediaHtml}
        <div class="post-actions">
            <i class="${isLiked ? 'fas' : 'far'} fa-bolt ${isLiked ? 'active' : ''}" onclick="likePost('${post.id}', this)"></i>
            <i class="far fa-comment" onclick="openComments('${post.id}')"></i>
            <i class="far fa-share-square" onclick="sharePost('${post.id}')"></i>
        </div>
        <div class="post-likes">
            <span>⚡️ ${post.likesCount || 0} молний</span>
        </div>
        ${commentsHtml}
        <div class="post-comments" onclick="openComments('${post.id}')">
            ${post.commentsCount || 0} комментариев
        </div>
    `;
    return postDiv;
}

function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    return date.toLocaleDateString();
}

// ============= ЛАЙКИ (МОЛНИИ) =============
async function likePost(postId, element) {
    try {
        const response = await fetch(`${SERVER_URL}/api/like/${postId}`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            if (data.liked) {
                element.className = 'fas fa-bolt active';
                element.style.animation = 'heartBeat 0.3s';
                setTimeout(() => {
                    element.style.animation = '';
                }, 300);
            } else {
                element.className = 'far fa-bolt';
            }
            
            const postDiv = element.closest('.post');
            const likesSpan = postDiv.querySelector('.post-likes span');
            if (likesSpan) {
                likesSpan.innerHTML = `⚡️ ${data.likes} молний`;
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= КОММЕНТАРИИ =============
function openComments(postId) {
    currentPostId = postId;
    const modal = document.getElementById('commentsModal');
    const container = document.getElementById('commentsContainer');
    
    if (!modal || !container) return;
    
    fetch(`${SERVER_URL}/api/posts`, {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(posts => {
            const post = posts.find(p => p.id === postId);
            container.innerHTML = '';
            
            if (post && post.comments && post.comments.length > 0) {
                post.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                post.comments.forEach(comment => {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'comment';
                    commentDiv.innerHTML = `
                        <div class="comment-avatar" onclick="goToProfile('${comment.userId}')">
                            <img src="${comment.userAvatar || 'https://via.placeholder.com/30'}" alt="">
                        </div>
                        <div class="comment-content">
                            <div class="comment-user" onclick="goToProfile('${comment.userId}')">${comment.username}</div>
                            <div class="comment-text">${comment.text}</div>
                            <div class="comment-time">${formatDate(new Date(comment.createdAt))}</div>
                        </div>
                        ${comment.userId === currentUserId ? `
                            <i class="fas fa-trash" onclick="deleteComment('${postId}', '${comment.id}')" style="color:#ff4444; font-size:14px; cursor:pointer; margin-left:5px;"></i>
                        ` : ''}
                    `;
                    container.appendChild(commentDiv);
                });
            } else {
                container.innerHTML = '<div class="no-comments">Нет комментариев</div>';
            }
        });
    
    modal.classList.add('show');
}

async function addComment() {
    const text = document.getElementById('commentText')?.value;
    if (!text || !currentPostId) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/comment/${currentPostId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text })
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('commentText').value = '';
            openComments(currentPostId);
            loadPosts();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function deleteComment(postId, commentId) {
    if (!confirm('Удалить комментарий?')) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/comment/${postId}/${commentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            openComments(postId);
            loadPosts();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= УДАЛЕНИЕ ПОСТА =============
async function deletePost(postId) {
    if (!confirm('Удалить пост? Это действие нельзя отменить.')) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/post/${postId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            const postElement = document.getElementById(`post-${postId}`);
            if (postElement) postElement.remove();
            showNotification('Пост удален', 'success');
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= РЕДАКТИРОВАНИЕ ПОСТА =============
function openEditPost(postId, title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'editPostModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Редактировать пост</h3>
                <i class="fas fa-times close-modal"></i>
            </div>
            <input type="text" id="editPostTitle" value="${title?.replace(/"/g, '&quot;') || ''}" placeholder="Заголовок" class="modal-input">
            <textarea id="editPostContent" placeholder="Описание..." rows="4" class="modal-textarea">${content?.replace(/"/g, '&quot;') || ''}</textarea>
            <button onclick="updatePost('${postId}')" class="save-btn">Сохранить</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function updatePost(postId) {
    const title = document.getElementById('editPostTitle')?.value;
    const content = document.getElementById('editPostContent')?.value;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/post/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, content })
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('editPostModal')?.remove();
            showNotification('Пост обновлен', 'success');
            loadPosts();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= ПЕРЕХОДЫ =============
function goToProfile(userId) {
    if (userId === currentUserId) {
        window.location.href = 'profile.html';
    } else {
        window.location.href = `profile.html?user=${userId}`;
    }
}

// ============= СОЗДАНИЕ ПОСТА =============
function openCreatePost() {
    const modal = document.getElementById('createPostModal');
    if (modal) modal.classList.add('show');
}

function previewMedia(input) {
    const preview = document.getElementById('mediaPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.controls = true;
                video.style.maxWidth = '100%';
                video.style.maxHeight = '200px';
                preview.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '200px';
                preview.appendChild(img);
            }
        };
        
        reader.readAsDataURL(file);
    }
}

async function createPost() {
    const title = document.getElementById('postTitle')?.value;
    const content = document.getElementById('postContent')?.value;
    const media = document.getElementById('postMedia')?.files[0];
    const publishBtn = document.querySelector('.publish-btn');
    
    if (!publishBtn) return;
    
    const originalText = publishBtn.innerHTML;
    
    if (!title && !content && !media) {
        showNotification('Добавьте заголовок, описание или медиа', 'error');
        return;
    }
    
    publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Публикация...';
    publishBtn.disabled = true;
    
    const formData = new FormData();
    if (title) formData.append('title', title);
    if (content) formData.append('content', content);
    if (media) formData.append('media', media);
    
    try {
        const response = await fetch(`${SERVER_URL}/api/create-post`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const modal = document.getElementById('createPostModal');
            if (modal) modal.classList.remove('show');
            
            const titleInput = document.getElementById('postTitle');
            const contentInput = document.getElementById('postContent');
            const mediaInput = document.getElementById('postMedia');
            const preview = document.getElementById('mediaPreview');
            
            if (titleInput) titleInput.value = '';
            if (contentInput) contentInput.value = '';
            if (mediaInput) mediaInput.value = '';
            if (preview) preview.innerHTML = '';
            
            showNotification('Пост опубликован! ⚡️', 'success');
            
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                loadPosts();
            }
        } else {
            showNotification(data.error || 'Ошибка создания поста', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сервера', 'error');
    } finally {
        publishBtn.innerHTML = originalText;
        publishBtn.disabled = false;
    }
}

// ============= ПРОФИЛЬ =============
if (window.location.pathname.endsWith('profile.html')) {
    document.addEventListener('DOMContentLoaded', loadProfile);
}

async function loadProfile() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user') || '';
        
        const response = await fetch(`${SERVER_URL}/api/profile/${userId}`, {
            credentials: 'include'
        });
        const profile = await response.json();
        
        if (!profile) {
            window.location.href = 'index.html';
            return;
        }
        
        // Заполняем профиль
        const avatarImg = document.getElementById('profileAvatar');
        if (avatarImg) avatarImg.src = profile.avatarUrl || 'https://via.placeholder.com/100';
        
        const postsCount = document.getElementById('postsCount');
        if (postsCount) postsCount.textContent = profile.postsCount || 0;
        
        const followersCount = document.getElementById('followersCount');
        if (followersCount) followersCount.textContent = formatNumber(profile.followersCount || 0);
        
        const followingCount = document.getElementById('followingCount');
        if (followingCount) followingCount.textContent = formatNumber(profile.followingCount || 0);
        
        const totalLikes = document.getElementById('totalLikes');
        if (totalLikes) totalLikes.textContent = formatNumber(profile.totalLikes || 0);
        
        const profileName = document.getElementById('profileName');
        if (profileName) profileName.textContent = profile.name || profile.username;
        
        const profileUsername = document.getElementById('profileUsername');
        if (profileUsername) profileUsername.textContent = '@' + profile.username;
        
        const bioElement = document.getElementById('profileBio');
        if (bioElement) {
            bioElement.innerHTML = profile.bio ? profile.bio.replace(/\n/g, '<br>') : '';
        }
        
        // Отображаем страну и статус
        const countryElement = document.getElementById('profileCountry');
        if (countryElement) {
            countryElement.innerHTML = `<i class="fas fa-globe"></i> ${profile.country || 'СНГ'}`;
        }
        
        const statusElement = document.getElementById('profileStatus');
        if (statusElement) {
            if (profile.isOnline) {
                statusElement.innerHTML = '<span class="online-status">🟢 Онлайн</span>';
            } else {
                const lastSeen = new Date(profile.lastSeen);
                statusElement.innerHTML = `<span class="offline-status">⚫ Был(а) ${formatDate(lastSeen)}</span>`;
            }
        }
        
        // Отображаем каналы
        const channelsContainer = document.getElementById('profileChannels');
        if (channelsContainer) {
            channelsContainer.innerHTML = '';
            if (profile.channels && profile.channels.length > 0) {
                channelsContainer.innerHTML = '<h4>Каналы:</h4>';
                profile.channels.forEach(channel => {
                    const channelDiv = document.createElement('div');
                    channelDiv.className = 'channel-badge';
                    channelDiv.onclick = () => window.location.href = `channel.html?id=${channel.id}`;
                    channelDiv.innerHTML = `
                        <img src="${channel.avatar || 'https://via.placeholder.com/20'}" alt="">
                        <span>${channel.name}</span>
                        <span style="font-size:10px; color:#888;">${channel.subscribers} подписчиков</span>
                    `;
                    channelsContainer.appendChild(channelDiv);
                });
            }
        }
        
        // Кнопка подписки/редактирования
        const actionBtn = document.querySelector('.profile-action-btn');
        const editBtn = document.querySelector('.edit-profile-btn');
        const messageBtn = document.querySelector('.message-btn');
        
        if (userId && userId !== currentUserId) {
            if (actionBtn) {
                actionBtn.style.display = 'block';
                actionBtn.className = `profile-action-btn ${profile.isFollowing ? 'following' : ''}`;
                actionBtn.innerHTML = profile.isFollowing ? '✓ Подписан' : 'Подписаться';
                actionBtn.onclick = () => followUser(userId, actionBtn);
            }
            if (editBtn) editBtn.style.display = 'none';
            if (messageBtn) {
                messageBtn.style.display = 'block';
                messageBtn.onclick = () => startChat(userId);
            }
        } else {
            if (actionBtn) actionBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = 'block';
            if (messageBtn) messageBtn.style.display = 'none';
        }
        
        // Посты пользователя
        const profilePosts = document.getElementById('profilePosts');
        if (profilePosts) {
            profilePosts.innerHTML = '';
            
            if (profile.posts && profile.posts.length > 0) {
                profile.posts.forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.className = 'profile-post';
                    postElement.onclick = () => window.location.href = `/?post=${post.id}`;
                    
                    if (post.mediaType === 'video' && post.mediaUrl) {
                        postElement.innerHTML = `
                            <video style="width:100%; height:100%; object-fit:cover;">
                                <source src="${post.mediaUrl}" type="video/mp4">
                            </video>
                            <div class="profile-post-overlay">
                                <div class="overlay-item">
                                    <i class="fas fa-bolt"></i>
                                    <span>${post.likesCount || 0}</span>
                                </div>
                            </div>
                        `;
                    } else if (post.mediaUrl) {
                        postElement.innerHTML = `
                            <img src="${post.mediaUrl}" alt="" loading="lazy">
                            <div class="profile-post-overlay">
                                <div class="overlay-item">
                                    <i class="fas fa-bolt"></i>
                                    <span>${post.likesCount || 0}</span>
                                </div>
                            </div>
                        `;
                    } else {
                        postElement.innerHTML = `
                            <div style="background:#333; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                                <i class="fas fa-file-alt" style="font-size:30px; color:#666;"></i>
                            </div>
                            <div class="profile-post-overlay">
                                <div class="overlay-item">
                                    <i class="fas fa-bolt"></i>
                                    <span>${post.likesCount || 0}</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    profilePosts.appendChild(postElement);
                });
            } else {
                profilePosts.innerHTML = '<div class="no-posts">Нет постов</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

async function followUser(userId, btn) {
    try {
        const response = await fetch(`${SERVER_URL}/api/follow/${userId}`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            if (data.isFollowing) {
                btn.classList.add('following');
                btn.innerHTML = '✓ Подписан';
            } else {
                btn.classList.remove('following');
                btn.innerHTML = 'Подписаться';
            }
            
            const followersSpan = document.getElementById('followersCount');
            if (followersSpan) {
                followersSpan.textContent = formatNumber(data.followersCount);
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function quickFollow(userId) {
    try {
        const response = await fetch(`${SERVER_URL}/api/follow/${userId}`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.isFollowing ? 'Подписан!' : 'Отписан', 'success');
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= РЕДАКТИРОВАНИЕ ПРОФИЛЯ =============
function openEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    modal.classList.add('show');
    
    fetch(`${SERVER_URL}/api/current-user`, {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                const avatarImg = document.getElementById('editAvatar');
                if (avatarImg) avatarImg.src = data.user.avatarUrl || 'https://via.placeholder.com/100';
                
                const usernameInput = document.getElementById('editUsername');
                if (usernameInput) usernameInput.value = data.user.username || '';
                
                const nameInput = document.getElementById('editName');
                if (nameInput) nameInput.value = data.user.name || '';
                
                const bioInput = document.getElementById('editBio');
                if (bioInput) bioInput.value = data.user.bio || '';
            }
        });
}

async function updateProfile() {
    const formData = new FormData();
    
    const usernameInput = document.getElementById('editUsername');
    const nameInput = document.getElementById('editName');
    const bioInput = document.getElementById('editBio');
    const avatarFile = document.getElementById('avatarInput')?.files[0];
    
    if (usernameInput) formData.append('username', usernameInput.value);
    if (nameInput) formData.append('name', nameInput.value);
    if (bioInput) formData.append('bio', bioInput.value);
    if (avatarFile) formData.append('avatar', avatarFile);
    
    const saveBtn = document.querySelector('.save-btn');
    if (!saveBtn) return;
    
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/update-profile`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const modal = document.getElementById('editProfileModal');
            if (modal) modal.classList.remove('show');
            showNotification('Профиль обновлен!', 'success');
            loadProfile();
        } else {
            showNotification(data.error || 'Ошибка обновления', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сервера', 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// ============= КАНАЛЫ =============
if (window.location.pathname.endsWith('channels.html')) {
    document.addEventListener('DOMContentLoaded', loadChannels);
}

async function loadChannels() {
    try {
        const response = await fetch(`${SERVER_URL}/api/channels`, {
            credentials: 'include'
        });
        const channels = await response.json();
        
        const container = document.getElementById('channelsContainer');
        if (!container) return;
        
        if (channels.length === 0) {
            container.innerHTML = '<div class="no-posts">Нет каналов. Создайте первый! ⚡️</div>';
            return;
        }
        
        container.innerHTML = '';
        channels.forEach(channel => {
            const channelDiv = document.createElement('div');
            channelDiv.className = 'channel-card';
            channelDiv.onclick = () => window.location.href = `channel.html?id=${channel.id}`;
            
            channelDiv.innerHTML = `
                <div class="channel-header">
                    <img src="${channel.avatarUrl || 'https://via.placeholder.com/50'}" alt="" class="channel-avatar">
                    <div class="channel-info">
                        <h3>${channel.name}</h3>
                        <p>Создатель: ${channel.creatorName}</p>
                    </div>
                    ${channel.isCreator ? '<i class="fas fa-cog" style="color:#3b82f6;" onclick="event.stopPropagation(); openEditChannel(\'' + channel.id + '\')"></i>' : ''}
                </div>
                <div class="channel-description">${channel.description || 'Нет описания'}</div>
                <div class="channel-stats">
                    <span><i class="fas fa-users"></i> ${channel.subscribersCount} подписчиков</span>
                    <span><i class="fas fa-bolt"></i> Требуется ${channel.requirements.minLikes || 0} лайков</span>
                </div>
                ${channel.isSubscriber ? 
                    '<div class="channel-subscribed">✓ Вы подписаны</div>' : 
                    (channel.canJoin ? 
                        '<button class="subscribe-btn" onclick="event.stopPropagation(); subscribeToChannel(\'' + channel.id + '\')">Подписаться</button>' : 
                        '<div class="channel-locked">🔒 Требования не выполнены</div>'
                    )
                }
            `;
            
            container.appendChild(channelDiv);
        });
    } catch (error) {
        console.error('Ошибка загрузки каналов:', error);
    }
}

function openCreateChannel() {
    const modal = document.getElementById('createChannelModal');
    if (modal) modal.classList.add('show');
}

function previewChannelAvatar(input) {
    const preview = document.getElementById('channelAvatarPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            img.style.borderRadius = '10px';
            preview.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function createChannel() {
    const name = document.getElementById('channelName')?.value;
    const description = document.getElementById('channelDescription')?.value;
    const minLikes = document.getElementById('reqMinLikes')?.value || 0;
    const mustFollow = document.getElementById('reqMustFollow')?.checked || false;
    const mustShare = document.getElementById('reqMustShare')?.checked || false;
    const avatar = document.getElementById('channelAvatar')?.files[0];
    
    if (!name) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description || '');
    formData.append('requirements', JSON.stringify({
        minLikes: parseInt(minLikes),
        mustFollow,
        mustShare
    }));
    if (avatar) formData.append('avatar', avatar);
    
    try {
        const response = await fetch(`${SERVER_URL}/api/create-channel`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const modal = document.getElementById('createChannelModal');
            if (modal) modal.classList.remove('show');
            showNotification('Канал создан!', 'success');
            loadChannels();
        } else {
            showNotification(data.error || 'Ошибка создания канала', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сервера', 'error');
    }
}

// ============= РЕДАКТИРОВАНИЕ КАНАЛА =============
function openEditChannel(channelId) {
    fetch(`${SERVER_URL}/api/channel/${channelId}`, {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(channel => {
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.id = 'editChannelModal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Редактировать канал</h3>
                        <i class="fas fa-times close-modal"></i>
                    </div>
                    <input type="text" id="editChannelName" value="${channel.name?.replace(/"/g, '&quot;') || ''}" placeholder="Название канала" class="modal-input">
                    <textarea id="editChannelDesc" placeholder="Описание" rows="3" class="modal-textarea">${channel.description ? channel.description.replace(/"/g, '&quot;') : ''}</textarea>
                    
                    <div class="channel-requirements">
                        <h4>Условия входа:</h4>
                        <label>
                            <input type="number" id="editReqMinLikes" value="${channel.requirements.minLikes || 0}" min="0">
                            Минимум лайков у создателя
                        </label>
                        <label>
                            <input type="checkbox" id="editReqMustFollow" ${channel.requirements.mustFollow ? 'checked' : ''}>
                            Требуется подписка на создателя
                        </label>
                        <label>
                            <input type="checkbox" id="editReqMustShare" ${channel.requirements.mustShare ? 'checked' : ''}>
                            Требуется репост
                        </label>
                    </div>

                    <div class="media-preview" id="editChannelAvatarPreview">
                        ${channel.avatarUrl ? `<img src="${channel.avatarUrl}" style="max-width:100%; max-height:200px;">` : ''}
                    </div>
                    <input type="file" id="editChannelAvatar" accept="image/*" onchange="previewEditChannelAvatar(this)" class="modal-file">
                    
                    <button onclick="updateChannel('${channel.id}')" class="save-btn">Сохранить</button>
                    <button onclick="deleteChannel('${channel.id}')" class="delete-btn" style="background-color:#ff4444; margin-top:10px;">Удалить канал</button>
                </div>
            `;
            document.body.appendChild(modal);
        });
}

function previewEditChannelAvatar(input) {
    const preview = document.getElementById('editChannelAvatarPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            preview.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function updateChannel(channelId) {
    const name = document.getElementById('editChannelName')?.value;
    const description = document.getElementById('editChannelDesc')?.value;
    const minLikes = document.getElementById('editReqMinLikes')?.value || 0;
    const mustFollow = document.getElementById('editReqMustFollow')?.checked || false;
    const mustShare = document.getElementById('editReqMustShare')?.checked || false;
    const avatar = document.getElementById('editChannelAvatar')?.files[0];
    
    if (!name) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description || '');
    formData.append('requirements', JSON.stringify({
        minLikes: parseInt(minLikes),
        mustFollow,
        mustShare
    }));
    if (avatar) formData.append('avatar', avatar);
    
    try {
        const response = await fetch(`${SERVER_URL}/api/channel/${channelId}`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('editChannelModal')?.remove();
            showNotification('Канал обновлен!', 'success');
            if (window.location.pathname.includes('channel.html')) {
                loadChannel();
            } else {
                loadChannels();
            }
        } else {
            showNotification(data.error || 'Ошибка обновления', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сервера', 'error');
    }
}

async function deleteChannel(channelId) {
    if (!confirm('Удалить канал? Это действие нельзя отменить.')) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/channel/${channelId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('editChannelModal')?.remove();
            showNotification('Канал удален', 'success');
            window.location.href = 'channels.html';
        } else {
            showNotification(data.error || 'Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сервера', 'error');
    }
}

async function subscribeToChannel(channelId) {
    try {
        const response = await fetch(`${SERVER_URL}/api/subscribe-channel/${channelId}`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Вы подписались на канал!', 'success');
            loadChannels();
        } else {
            showNotification(data.error || 'Ошибка подписки', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= ЧАТЫ =============
if (window.location.pathname.endsWith('chat.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('id');
        
        if (chatId) {
            document.getElementById('chatsList').style.display = 'none';
            document.getElementById('chatWindow').style.display = 'flex';
            loadMessages(chatId);
        } else {
            document.getElementById('chatsList').style.display = 'block';
            document.getElementById('chatWindow').style.display = 'none';
            loadChats();
        }
    });
}

async function loadChats() {
    try {
        const response = await fetch(`${SERVER_URL}/api/chats`, {
            credentials: 'include'
        });
        const chats = await response.json();
        
        const container = document.getElementById('chatsContainer');
        if (!container) return;
        
        if (chats.length === 0) {
            container.innerHTML = '<div class="no-posts">Нет чатов. Начните общение! 💬</div>';
            return;
        }
        
        container.innerHTML = '';
        chats.sort((a, b) => {
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(a.createdAt);
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(b.createdAt);
            return bTime - aTime;
        });
        
        chats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = 'chat-item';
            chatDiv.onclick = () => window.location.href = `chat.html?id=${chat.id}`;
            
            let avatar = chat.avatar || 'https://via.placeholder.com/50';
            let name = chat.name;
            let status = '';
            
            if (chat.type === 'private' && chat.otherMembers && chat.otherMembers[0]) {
                const member = chat.otherMembers[0];
                avatar = member.avatar || 'https://via.placeholder.com/50';
                name = member.name;
                status = member.status === 'online' ? '<span class="online-dot"></span>' : '';
            }
            
            const lastMessageTime = chat.lastMessage ? formatDate(new Date(chat.lastMessage.createdAt)) : '';
            
            chatDiv.innerHTML = `
                <div class="chat-avatar">
                    <img src="${avatar}" alt="">
                    ${status}
                </div>
                <div class="chat-info">
                    <div class="chat-name">${name} ${chat.type === 'group' ? '(группа)' : ''}</div>
                    <div class="chat-last-message">${chat.lastMessage?.text || 'Нет сообщений'}</div>
                </div>
                <div class="chat-time">${lastMessageTime}</div>
                ${chat.unread ? `<div class="chat-unread">${chat.unread}</div>` : ''}
            `;
            
            container.appendChild(chatDiv);
        });
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

let typingTimeout = null;

async function loadMessages(chatId) {
    try {
        const response = await fetch(`${SERVER_URL}/api/chat/${chatId}/messages`, {
            credentials: 'include'
        });
        const messages = await response.json();
        
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        messages.forEach(msg => {
            addMessageToChat(msg);
        });
        
        container.scrollTop = container.scrollHeight;
        
        if (ws) {
            ws.send(JSON.stringify({
                type: 'read',
                chatId: chatId,
                userId: currentUserId
            }));
        }
        
        const input = document.getElementById('messageInput');
        if (input) {
            input.addEventListener('input', () => {
                if (ws) {
                    ws.send(JSON.stringify({
                        type: 'typing',
                        chatId: chatId,
                        userId: currentUserId
                    }));
                    
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => {
                        // Можно отправить stopped typing
                    }, 1000);
                }
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
}

function addMessageToChat(message) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${message.userId === currentUserId ? 'my-message' : 'other-message'}`;
    
    const readStatus = message.read?.includes(currentUserId) ? '✓✓' : '✓';
    
    msgDiv.innerHTML = `
        <div class="message-content">${message.text}</div>
        <div class="message-time">
            ${formatDate(new Date(message.createdAt))}
            ${message.userId === currentUserId ? `<span class="read-status">${readStatus}</span>` : ''}
        </div>
    `;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    const text = input.value.trim();
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    
    if (!text || !chatId || !ws) return;
    
    ws.send(JSON.stringify({
        type: 'message',
        chatId: chatId,
        userId: currentUserId,
        text: text
    }));
    
    input.value = '';
}

function showTypingIndicator(userId) {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }
}

function backToChats() {
    window.location.href = 'chat.html';
}

function openNewChat() {
    const modal = document.getElementById('newChatModal');
    if (modal) modal.classList.add('show');
}

async function searchUsersForChat() {
    const query = document.getElementById('newChatSearch')?.value;
    const resultsDiv = document.getElementById('newChatResults');
    
    if (!query || query.length < 2) {
        if (resultsDiv) resultsDiv.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}&type=users`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        resultsDiv.innerHTML = '';
        
        (data.users || []).forEach(user => {
            if (user.id === currentUserId) return;
            
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.onclick = () => startChat(user.id);
            div.innerHTML = `
                <img src="${user.avatar || 'https://via.placeholder.com/40'}" alt="">
                <div style="flex:1">
                    <strong>${user.name}</strong>
                    <div>@${user.username}</div>
                </div>
                <i class="fas fa-plus-circle" style="color:#3b82f6;"></i>
            `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

async function startChat(userId) {
    try {
        const response = await fetch(`${SERVER_URL}/api/create-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                type: 'private',
                members: [userId]
            })
        });
        
        const data = await response.json();
        if (data.success) {
            const modal = document.getElementById('newChatModal');
            if (modal) modal.classList.remove('show');
            window.location.href = `chat.html?id=${data.chat.id}`;
        }
    } catch (error) {
        console.error('Ошибка создания чата:', error);
    }
}

function openCreateGroup() {
    const modal = document.getElementById('createGroupModal');
    if (modal) modal.classList.add('show');
    selectedUsers = [];
    updateSelectedUsers();
}

async function searchUsersForGroup() {
    const query = document.getElementById('groupSearch')?.value;
    const resultsDiv = document.getElementById('groupSearchResults');
    
    if (!query || query.length < 2) {
        if (resultsDiv) resultsDiv.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}&type=users`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        resultsDiv.innerHTML = '';
        
        (data.users || []).forEach(user => {
            if (user.id === currentUserId || selectedUsers.includes(user.id)) return;
            
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.onclick = () => addUserToGroup(user);
            div.innerHTML = `
                <img src="${user.avatar || 'https://via.placeholder.com/40'}" alt="">
                <div style="flex:1">
                    <strong>${user.name}</strong>
                    <div>@${user.username}</div>
                </div>
                <i class="fas fa-plus-circle" style="color:#3b82f6;"></i>
            `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

function addUserToGroup(user) {
    if (!selectedUsers.includes(user.id)) {
        selectedUsers.push(user.id);
        updateSelectedUsers();
    }
    document.getElementById('groupSearch').value = '';
    document.getElementById('groupSearchResults').innerHTML = '';
}

function removeUserFromGroup(userId) {
    selectedUsers = selectedUsers.filter(id => id !== userId);
    updateSelectedUsers();
}

function updateSelectedUsers() {
    const container = document.getElementById('selectedUsers');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (selectedUsers.length === 0) {
        container.innerHTML = '<div style="color:#888; padding:10px;">Нет выбранных пользователей</div>';
        return;
    }
    
    selectedUsers.forEach(userId => {
        fetch(`${SERVER_URL}/api/search?q=${userId}&type=users`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                const user = data.users?.find(u => u.id === userId);
                if (user) {
                    const div = document.createElement('div');
                    div.className = 'selected-user';
                    div.innerHTML = `
                        <img src="${user.avatar || 'https://via.placeholder.com/20'}" alt="">
                        <span>${user.name}</span>
                        <i class="fas fa-times" onclick="removeUserFromGroup('${userId}')"></i>
                    `;
                    container.appendChild(div);
                }
            });
    });
}

async function createGroup() {
    const name = document.getElementById('groupName')?.value;
    
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    if (selectedUsers.length === 0) {
        showNotification('Добавьте участников', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${SERVER_URL}/api/create-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                type: 'group',
                name: name,
                members: selectedUsers
            })
        });
        
        const data = await response.json();
        if (data.success) {
            const modal = document.getElementById('createGroupModal');
            if (modal) modal.classList.remove('show');
            window.location.href = `chat.html?id=${data.chat.id}`;
        }
    } catch (error) {
        console.error('Ошибка создания группы:', error);
    }
}

// ============= РЕДАКТИРОВАНИЕ ГРУППЫ =============
function openEditGroup(chatId) {
    fetch(`${SERVER_URL}/api/chats`, {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(chats => {
            const chat = chats.find(c => c.id === chatId);
            if (!chat || chat.type !== 'group') return;
            
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.id = 'editGroupModal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Редактировать группу</h3>
                        <i class="fas fa-times close-modal"></i>
                    </div>
                    <input type="text" id="editGroupName" value="${chat.name || ''}" placeholder="Название группы" class="modal-input">
                    
                    <h4>Участники:</h4>
                    <div id="editGroupMembers" class="selected-users">
                        ${chat.otherMembers?.map(m => `
                            <div class="selected-user">
                                <img src="${m.avatar || 'https://via.placeholder.com/20'}" alt="">
                                <span>${m.name}</span>
                                ${chat.isAdmin ? '<i class="fas fa-times" onclick="removeFromGroup(\'' + chat.id + '\', \'' + m.id + '\')"></i>' : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    ${chat.isAdmin ? `
                        <input type="text" id="addMemberSearch" placeholder="Добавить участника..." class="modal-input" oninput="searchUsersToAdd('${chat.id}')">
                        <div id="addMemberResults" class="search-results" style="position:static; display:block;"></div>
                        
                        <button onclick="leaveGroup('${chat.id}')" class="delete-btn" style="background-color:#ff4444; margin-top:10px;">Покинуть группу</button>
                    ` : ''}
                    
                    <button onclick="updateGroup('${chat.id}')" class="save-btn">Сохранить</button>
                </div>
            `;
            document.body.appendChild(modal);
        });
}

async function searchUsersToAdd(chatId) {
    const query = document.getElementById('addMemberSearch')?.value;
    const resultsDiv = document.getElementById('addMemberResults');
    
    if (!query || query.length < 2) {
        if (resultsDiv) resultsDiv.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}&type=users`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        resultsDiv.innerHTML = '';
        (data.users || []).forEach(user => {
            if (user.id === currentUserId) return;
            
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.onclick = () => addToGroup(chatId, user.id);
            div.innerHTML = `
                <img src="${user.avatar || 'https://via.placeholder.com/40'}" alt="">
                <div style="flex:1">
                    <strong>${user.name}</strong>
                    <div>@${user.username}</div>
                </div>
                <i class="fas fa-plus-circle" style="color:#3b82f6;"></i>
            `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function addToGroup(chatId, userId) {
    try {
        const response = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
            credentials: 'include'
        });
        const chat = await response.json();
        
        const newMembers = [...chat.members, userId];
        
        const updateResponse = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ members: newMembers })
        });
        
        const data = await updateResponse.json();
        if (data.success) {
            showNotification('Участник добавлен', 'success');
            document.getElementById('editGroupModal')?.remove();
            openEditGroup(chatId);
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function removeFromGroup(chatId, userId) {
    if (!confirm('Удалить участника из группы?')) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
            credentials: 'include'
        });
        const chat = await response.json();
        
        const newMembers = chat.members.filter(id => id !== userId);
        
        const updateResponse = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ members: newMembers })
        });
        
        const data = await updateResponse.json();
        if (data.success) {
            showNotification('Участник удален', 'success');
            document.getElementById('editGroupModal')?.remove();
            openEditGroup(chatId);
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function updateGroup(chatId) {
    const name = document.getElementById('editGroupName')?.value;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/chat/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('editGroupModal')?.remove();
            showNotification('Группа обновлена', 'success');
            loadMessages(chatId);
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function leaveGroup(chatId) {
    if (!confirm('Покинуть группу?')) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/chat/${chatId}/leave`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Вы покинули группу', 'info');
            window.location.href = 'chat.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============= КАНАЛ (отдельный) =============
if (window.location.pathname.endsWith('channel.html')) {
    document.addEventListener('DOMContentLoaded', loadChannel);
}

async function loadChannel() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const channelId = urlParams.get('id');
        
        if (!channelId) {
            window.location.href = 'channels.html';
            return;
        }
        
        const response = await fetch(`${SERVER_URL}/api/channel/${channelId}`, {
            credentials: 'include'
        });
        const channel = await response.json();
        
        const container = document.getElementById('channelContent');
        if (!container) return;
        
        container.innerHTML = `
            <div class="channel-header-full">
                <img src="${channel.avatarUrl || 'https://via.placeholder.com/100'}" alt="" class="channel-big-avatar">
                <div class="channel-info-full">
                    <h1>${channel.name}</h1>
                    <p class="channel-creator" onclick="goToProfile('${channel.creatorId}')">
                        <img src="${channel.creatorAvatar || 'https://via.placeholder.com/20'}" alt="">
                        ${channel.creatorName} (@${channel.creatorUsername})
                    </p>
                    ${channel.isCreator ? '<button class="edit-channel-btn" onclick="openEditChannel(\'' + channel.id + '\')"><i class="fas fa-edit"></i> Редактировать</button>' : ''}
                </div>
            </div>
            
            <div class="channel-description-full">
                ${channel.description || 'Нет описания'}
            </div>
            
            <div class="channel-stats-full">
                <div class="stat-item">
                    <span class="stat-value">${channel.subscribersCount}</span>
                    <span class="stat-label">подписчиков</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${channel.creatorLikes || 0}</span>
                    <span class="stat-label">молний у создателя</span>
                </div>
            </div>
            
            <div class="channel-requirements-box">
                <h3>⚡️ Условия входа:</h3>
                <ul>
                    <li>🔋 Минимум лайков у создателя: ${channel.requirements.minLikes || 0}</li>
                    <li>👥 Требуется подписка: ${channel.requirements.mustFollow ? 'Да' : 'Нет'}</li>
                    <li>🔄 Требуется репост: ${channel.requirements.mustShare ? 'Да' : 'Нет'}</li>
                </ul>
            </div>
            
            ${channel.isSubscriber ? 
                '<div class="subscribed-badge">✓ Вы подписаны на канал</div>' : 
                (channel.canJoin ? 
                    '<button class="subscribe-big-btn" onclick="subscribeToChannel(\'' + channel.id + '\')">Подписаться на канал</button>' : 
                    '<div class="cannot-join">🔒 Вы не соответствуете требованиям</div>'
                )
            }
        `;
    } catch (error) {
        console.error('Ошибка загрузки канала:', error);
    }
}

// ============= СТАТУСЫ ПОЛЬЗОВАТЕЛЕЙ =============
function updateUserStatus(userId, status, lastSeen) {
    const statusElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
    statusElements.forEach(el => {
        if (status === 'online') {
            el.className = 'user-status online';
            el.title = 'Онлайн';
        } else {
            el.className = 'user-status offline';
            if (lastSeen) {
                const lastSeenDate = new Date(lastSeen);
                const diff = Math.floor((new Date() - lastSeenDate) / 60000);
                if (diff < 60) {
                    el.title = `Был(а) ${diff} мин назад`;
                } else {
                    el.title = `Был(а) ${Math.floor(diff / 60)} ч назад`;
                }
            }
        }
    });
}

// ============= ОБЩИЕ ФУНКЦИИ =============
function openImage(url) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content image-modal">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <img src="${url}" style="max-width: 100%; max-height: 80vh;">
        </div>
    `;
    document.body.appendChild(modal);
}

function sharePost(postId) {
    if (navigator.share) {
        navigator.share({
            title: 'Пост в Лыся',
            url: window.location.origin + '/?post=' + postId
        });
    } else {
        prompt('Скопируйте ссылку:', window.location.origin + '/?post=' + postId);
    }
}

async function logout() {
    if (confirm('Вы действительно хотите выйти?')) {
        await fetch(`${SERVER_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = 'login.html';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Закрытие модальных окон
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            btn.closest('.modal').classList.remove('show');
        };
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        };
    });
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('searchContainer');
        const searchIcon = document.querySelector('.fa-search');
        if (searchContainer && searchIcon) {
            if (!searchContainer.contains(e.target) && !searchIcon.contains(e.target)) {
                searchContainer.style.display = 'none';
            }
        }
    });
});