// ============= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =============
let currentUserId = null;
let currentPostId = null;
let ws = null;
let selectedUsers = [];

// ============= НАСТРОЙКИ СЕРВЕРА =============
// ⚠️ ВАЖНО: ЗАМЕНИТЕ ЭТОТ АДРЕС НА ТОТ, ЧТО У ВАС В ТЕРМИНАЛЕ!
const SERVER_URL = 'https://ec9b58ee-a317-480d-b709-1a81e0312d2e.tunnel4.com';
const WS_URL = SERVER_URL.replace('http', 'ws');

// ============= ПРОВЕРКА АВТОРИЗАЦИИ =============
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
        showNotification('Сервер недоступен! Проверьте подключение', 'error');
    }
}

// ============= WEB-SOCKET ПОДКЛЮЧЕНИЕ =============
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
        const response = await fetch(`${SERVER_URL}/api/posts`, {
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
    } catch (error) {
        console.error('Ошибка загрузки постов:', error);
        const container = document.getElementById('posts-container');
        if (container) {
            container.innerHTML = '<div class="no-posts">❌ Сервер не отвечает. Проверьте подключение!</div>';
        }
    }
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.id = `post-${post.id}`;
    
    const isLiked = post.isLiked;
    const postDate = new Date(post.createdAt);
    const timeString = formatDate(postDate);
    
    let hashtagsHtml = '';
    if (post.hashtags && post.hashtags.length > 0) {
        hashtagsHtml = '<div class="post-hashtags">';
        post.hashtags.forEach(tag => {
            hashtagsHtml += `<span onclick="window.location.href='/?tag=${tag.replace('#', '')}'">${tag}</span> `;
        });
        hashtagsHtml += '</div>';
    }
    
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
    
    const titleHtml = post.title ? `<h3 class="post-title">⚡️ ${post.title}</h3>` : '';
    
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-avatar" onclick="goToProfile('${post.userId}')">
                <img src="${post.userAvatar || 'https://via.placeholder.com/40'}" alt="${post.username}" loading="lazy">
            </div>
            <div class="post-user">
                <strong onclick="goToProfile('${post.userId}')">${post.userName || post.username}</strong>
                ${post.userCountry ? `<span class="user-country-badge">${post.userCountry}</span>` : ''}
                <span>• ${timeString}</span>
            </div>
            ${post.userId === currentUserId ? `
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

// ============= ЛАЙКИ =============
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
    if (modal) modal.classList.add('show');
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
            showNotification('Комментарий добавлен', 'success');
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
        
        document.getElementById('profileAvatar').src = profile.avatarUrl || 'https://via.placeholder.com/100';
        document.getElementById('postsCount').textContent = profile.postsCount || 0;
        document.getElementById('followersCount').textContent = formatNumber(profile.followersCount || 0);
        document.getElementById('followingCount').textContent = formatNumber(profile.followingCount || 0);
        document.getElementById('profileName').textContent = profile.name || profile.username;
        document.getElementById('profileUsername').textContent = '@' + profile.username;
        document.getElementById('profileBio').innerHTML = profile.bio ? profile.bio.replace(/\n/g, '<br>') : '';
        
        const countryElement = document.getElementById('profileCountry');
        if (countryElement) {
            countryElement.innerHTML = `<i class="fas fa-globe"></i> ${profile.country || 'СНГ'}`;
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
        chats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = 'chat-item';
            chatDiv.onclick = () => window.location.href = `chat.html?id=${chat.id}`;
            
            let avatar = chat.avatar || 'https://via.placeholder.com/50';
            let name = chat.name;
            
            if (chat.type === 'private' && chat.otherMembers && chat.otherMembers[0]) {
                const member = chat.otherMembers[0];
                avatar = member.avatar || 'https://via.placeholder.com/50';
                name = member.name;
            }
            
            chatDiv.innerHTML = `
                <div class="chat-avatar">
                    <img src="${avatar}" alt="">
                </div>
                <div class="chat-info">
                    <div class="chat-name">${name}</div>
                    <div class="chat-last-message">${chat.lastMessage?.text || 'Нет сообщений'}</div>
                </div>
            `;
            
            container.appendChild(chatDiv);
        });
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

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
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
}

function addMessageToChat(message) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${message.userId === currentUserId ? 'my-message' : 'other-message'}`;
    msgDiv.innerHTML = `
        <div class="message-content">${message.text}</div>
        <div class="message-time">${formatDate(new Date(message.createdAt))}</div>
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
                </div>
                <div class="channel-description">${channel.description || 'Нет описания'}</div>
                <div class="channel-stats">
                    <span><i class="fas fa-users"></i> ${channel.subscribersCount} подписчиков</span>
                </div>
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
        notification.remove();
    }, 3000);
}

function updateUserStatus(userId, status, lastSeen) {
    // Функция для обновления статуса пользователя
}

// ============= ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН =============
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
});
