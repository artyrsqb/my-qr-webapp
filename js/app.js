const tg = window.Telegram.WebApp;
tg.ready();

const user = tg.initDataUnsafe?.user;
const myName = user?.first_name || "Друг";
const myId = user ? user.id.toString() : "guest";

let startParam = tg.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('tgWebAppStartParam');
const roomId = startParam || myId;

let currentTab = 'todo';
let dataCache = { todo: {}, done: {}, tags: {}, categories: {}, templates: {}, shops: {}, recipes: {} };
let activeNoteId = null;
let activeRecipeId = null;
let lastKnownTimestamp = Date.now();

// -------- TELEGRAM CLOUD STORAGE --------
const CloudStorage = {
    async setItem(key, value) {
        return new Promise((resolve, reject) => {
            tg.CloudStorage.setItem(key, JSON.stringify(value), (error, result) => {
                if (error) {
                    console.error('CloudStorage setItem error:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    },
    async getItem(key) {
        return new Promise((resolve, reject) => {
            tg.CloudStorage.getItem(key, (error, result) => {
                if (error) {
                    console.error('CloudStorage getItem error:', error);
                    reject(error);
                } else {
                    resolve(result ? JSON.parse(result) : null);
                }
            });
        });
    },
    async removeItem(key) {
        return new Promise((resolve, reject) => {
            tg.CloudStorage.removeItem(key, (error, result) => {
                if (error) {
                    console.error('CloudStorage removeItem error:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    },
    async getKeys() {
        return new Promise((resolve, reject) => {
            tg.CloudStorage.getKeys((error, result) => {
                if (error) {
                    console.error('CloudStorage getKeys error:', error);
                    reject(error);
                } else {
                    resolve(result || []);
                }
            });
        });
    }
};

// Функции для работы с данными в Cloud Storage
async function loadAllData() {
    try {
        const [todo, done, tags, categories, templates, shops, recipes] = await Promise.all([
            CloudStorage.getItem(`${roomId}_todo`),
            CloudStorage.getItem(`${roomId}_done`),
            CloudStorage.getItem(`${roomId}_tags`),
            CloudStorage.getItem(`${roomId}_categories`),
            CloudStorage.getItem(`${roomId}_templates`),
            CloudStorage.getItem(`${roomId}_shops`),
            CloudStorage.getItem(`${roomId}_recipes`)
        ]);

        dataCache = {
            todo: todo || {},
            done: done || {},
            tags: tags || {},
            categories: categories || {},
            templates: templates || {},
            shops: shops || {},
            recipes: recipes || {}
        };

        renderItems();
        renderQuickTags();
        updateCategorySelect();
        renderQuickTemplates();
        updateShopSelect();
        renderRecipes();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function saveData(section, data) {
    try {
        dataCache[section] = data;
        await CloudStorage.setItem(`${roomId}_${section}`, data);
        
        // Обновляем интерфейс
        if (section === 'todo' || section === 'done') {
            renderItems();
        } else if (section === 'tags') {
            renderQuickTags();
            renderManageTags();
        } else if (section === 'categories') {
            updateCategorySelect();
            renderManageCategories();
        } else if (section === 'templates') {
            renderQuickTemplates();
            renderManageTemplates();
        } else if (section === 'shops') {
            updateShopSelect();
            renderManageShops();
        } else if (section === 'recipes') {
            renderRecipes();
        }
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Загружаем данные при старте
loadAllData();

// -------- НАСТРОЙКА ВРЕМЕНИ ПОКАЗА РЕКЛАМЫ --------
setTimeout(() => {
    showAd();
}, 1 * 60 * 1000); 


// -------- МАСКОТ АВОКАДО --------
function showNotification(message, type = 'success') {
    const mascot = document.getElementById('mascot-notification');
    const mascotText = document.getElementById('mascot-text');
    
    // Устанавливаем текст сообщения
    mascotText.textContent = message;
    
    // Показываем маскота
    mascot.classList.add('show');
    
    // Вибрация (если доступна)
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }
    
    // Скрываем через 3.5 секунды
    setTimeout(() => {
        mascot.classList.remove('show');
    }, 3500);
}

// -------- РЕКЛАМА --------
function showAd() {
    const adBanner = document.getElementById('ad-banner');
    
    // Показываем рекламу и оставляем её видимой (не скрываем)
    adBanner.classList.add('show');
}

// -------- ТЕМЫ --------
const THEME_KEY = 'family-shopping-theme';

function applyTheme(theme) {
    const body = document.body;
    const btnIcon = document.getElementById('theme-toggle-icon');
    const btnText = document.getElementById('theme-toggle-text');

    if (theme === 'dark') {
        body.classList.add('theme-dark');
        // Цвета Telegram для тёмной темы
        tg.setHeaderColor('#18181b');
        tg.setBackgroundColor('#18181b');
        if (btnIcon && btnText) {
            btnIcon.textContent = '🌙';
            btnText.textContent = 'Тёмная';
        }
    } else {
        body.classList.remove('theme-dark');
        // Цвета Telegram для светлой темы
        tg.setHeaderColor('#f3f4f6');
        tg.setBackgroundColor('#f3f4f6');
        if (btnIcon && btnText) {
            btnIcon.textContent = '🌞';
            btnText.textContent = 'Светлая';
        }
    }

    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
}

// Инициализация темы при загрузке
(function initTheme() {
    let saved = 'light';
    try {
        const fromStorage = localStorage.getItem(THEME_KEY);
        if (fromStorage === 'light' || fromStorage === 'dark') {
            saved = fromStorage;
        }
    } catch (e) {}
    applyTheme(saved);
})();

// Обработчик клика по кнопке темы
document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    applyTheme(isDark ? 'light' : 'dark');
});

// Функция сворачивания/разворачивания карточки создания списка
function toggleInputCard() {
    const content = document.getElementById('input-card-content');
    const icon = document.getElementById('toggle-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        icon.textContent = '▼';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        icon.textContent = '▶';
    }
}

const area = document.getElementById('item-text');
area.oninput = function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
};

const recipeDesc = document.getElementById('recipe-description');
recipeDesc.oninput = function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
};

const recipeIngr = document.getElementById('recipe-ingredients');
recipeIngr.oninput = function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
};

const editItems = document.getElementById('edit-items');
editItems.oninput = function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
};

function updateShopSelect() {
    const select = document.getElementById('item-shop');
    const currentVal = select.value;
    select.innerHTML = '<option value="">🛒 Любой магазин</option>';
    Object.keys(dataCache.shops).forEach(id => select.add(new Option(dataCache.shops[id].name, dataCache.shops[id].name)));
    if(currentVal) select.value = currentVal;
}

function renderManageShops() {
    const list = document.getElementById('manage-shops-list');
    list.innerHTML = '';
    Object.keys(dataCache.shops).forEach(id => {
        list.innerHTML += `<div class="manage-tag-item"><span>${dataCache.shops[id].name}</span><button class="btn-action btn-del" onclick="deleteShop('${id}')"><img src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png" class="icon-del"></button></div>`;
    });
}

async function deleteShop(id) {
    const updatedShops = { ...dataCache.shops };
    delete updatedShops[id];
    await saveData('shops', updatedShops);
}

async function addNewShop() {
    const input = document.getElementById('new-shop-name');
    const name = input.value.trim();
    if (name) {
        const newId = 'shop_' + Date.now();
        const updatedShops = { ...dataCache.shops, [newId]: { name } };
        await saveData('shops', updatedShops);
        input.value = '';
    }
}

function updateCategorySelect() {
    const select = document.getElementById('item-category');
    const currentVal = select.value;
    select.innerHTML = '';
    const defaultCats = ["🍎 Продукты", "🏠 Дом", "💊 Аптека", "👕 Одежда", "📦 Другое"];
    const hasDbCats = Object.keys(dataCache.categories).length > 0;
    if (!hasDbCats) defaultCats.forEach(c => select.add(new Option(c, c)));
    else Object.keys(dataCache.categories).forEach(id => select.add(new Option(dataCache.categories[id].name, dataCache.categories[id].name)));
    if(currentVal) select.value = currentVal;
}

function renderManageCategories() {
    const list = document.getElementById('manage-cats-list');
    list.innerHTML = '';
    Object.keys(dataCache.categories).forEach(id => {
        list.innerHTML += `<div class="manage-tag-item"><span>${dataCache.categories[id].name}</span><button class="btn-action btn-del" onclick="deleteCategory('${id}')"><img src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png" class="icon-del"></button></div>`;
    });
}

async function deleteCategory(id) {
    const updatedCategories = { ...dataCache.categories };
    delete updatedCategories[id];
    await saveData('categories', updatedCategories);
}

async function addNewCategory() {
    const input = document.getElementById('new-cat-name');
    const name = input.value.trim();
    if (name) {
        const newId = 'cat_' + Date.now();
        const updatedCategories = { ...dataCache.categories, [newId]: { name } };
        await saveData('categories', updatedCategories);
        input.value = '';
    }
}

function renderQuickTags() {
    const list = document.getElementById('quick-tags-list');
    list.innerHTML = '';
    Object.keys(dataCache.tags).forEach(id => {
        const div = document.createElement('div');
        div.className = 'tag';
        div.innerText = `+ ${dataCache.tags[id].name}`;
        div.onclick = () => { area.value += (area.value ? '\n' : '') + dataCache.tags[id].name; area.oninput(); };
        list.appendChild(div);
    });
}

function renderManageTags() {
    const list = document.getElementById('manage-tags-list');
    list.innerHTML = '';
    Object.keys(dataCache.tags).forEach(id => {
        list.innerHTML += `<div class="manage-tag-item"><span>${dataCache.tags[id].name}</span><button class="btn-action btn-del" onclick="deleteTag('${id}')"><img src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png" class="icon-del"></button></div>`;
    });
}

async function deleteTag(id) {
    const updatedTags = { ...dataCache.tags };
    delete updatedTags[id];
    await saveData('tags', updatedTags);
}

async function addNewTag() {
    const input = document.getElementById('new-tag-name');
    const name = input.value.trim();
    if (name) {
        const newId = 'tag_' + Date.now();
        const updatedTags = { ...dataCache.tags, [newId]: { name } };
        await saveData('tags', updatedTags);
        input.value = '';
    }
}

function renderQuickTemplates() {
    const list = document.getElementById('quick-templates-list');
    const section = document.getElementById('template-section');
    list.innerHTML = '';
    const keys = Object.keys(dataCache.templates);
    if (keys.length > 0) {
        section.style.display = 'block';
        keys.forEach(id => {
            const div = document.createElement('div');
            div.className = 'tag'; 
            div.innerText = `📋 ${dataCache.templates[id].name}`;
            div.onclick = () => { area.value = dataCache.templates[id].text; area.oninput(); };
            list.appendChild(div);
        });
    } else section.style.display = 'none';
}

function renderManageTemplates() {
    const list = document.getElementById('manage-temps-list');
    list.innerHTML = '';
    Object.keys(dataCache.templates).forEach(id => {
        list.innerHTML += `<div class="manage-tag-item"><span>${dataCache.templates[id].name}</span><button class="btn-action btn-del" onclick="deleteTemplate('${id}')"><img src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png" class="icon-del"></button></div>`;
    });
}

async function deleteTemplate(id) {
    const updatedTemplates = { ...dataCache.templates };
    delete updatedTemplates[id];
    await saveData('templates', updatedTemplates);
}

async function addNewTemplate() {
    const n = document.getElementById('new-temp-name');
    const t = document.getElementById('new-temp-text');
    const name = n.value.trim();
    const text = t.value.trim();
    if (name && text) {
        const newId = 'temp_' + Date.now();
        const updatedTemplates = { ...dataCache.templates, [newId]: { name, text } };
        await saveData('templates', updatedTemplates);
        n.value = '';
        t.value = '';
        showNotification('Шаблон добавлен', 'success');
    }
}

function openTagSettings() { 
    document.getElementById('tag-modal').style.display = 'flex'; 
    renderManageShops(); renderManageCategories(); renderManageTags(); renderManageTemplates();
}

document.getElementById('shop-form').onsubmit = async (e) => {
e.preventDefault();
let text = area.value.trim();
if (!text) return;

// Регулярные выражения для поиска данных
const catMatch = text.match(/📍 Категория:\s*(.+)/);
const shopMatch = text.match(/🛒 Магазин:\s*(.+)/);
const dateMatch = text.match(/📅 Дата:\s*(.+)/);

// Очищаем текст от служебных строк, чтобы остались только товары
let cleanText = text
    .replace(/📍 Категория:.*\n?/, '')
    .replace(/🛒 Магазин:.*\n?/, '')
    .replace(/📅 Дата:.*\n?/, '')
    .replace(/──────────────\n?/, '')
    .replace(/^[✅▫️]\s*/gm, '') // Убираем иконки статуса
    .trim();

const items = cleanText.split('\n').map(t => ({ text: t.trim(), checked: false })).filter(t => t.text);

const newId = 'note_' + Date.now();
const updatedTodo = { 
    ...dataCache.todo, 
    [newId]: {
        items, 
        category: catMatch ? catMatch[1].trim() : document.getElementById('item-category').value, 
        shop: shopMatch ? shopMatch[1].trim() : document.getElementById('item-shop').value,
        date: dateMatch ? dateMatch[1].trim() : document.getElementById('buy-date').value,
        author: myName, 
        timestamp: Date.now()
    }
};

await saveData('todo', updatedTodo);

e.target.reset(); 
area.style.height = '80px';
};

function renderItems() {
    const list = document.getElementById('shop-list');
    list.innerHTML = '';
    const activeData = currentTab === 'todo' ? dataCache.todo : dataCache.done;
    const sortedKeys = Object.keys(activeData).sort((a, b) => activeData[b].timestamp - activeData[a].timestamp);

    sortedKeys.forEach(id => {
        const note = activeData[id];
        const checkedCount = note.items.filter(i => i.checked).length;
        const div = document.createElement('div');
        div.className = 'item-row';
        
        // Добавляем класс для анимации, если элемент новый (добавлен за последние 3 секунды)
        const isNew = note.timestamp > lastKnownTimestamp;
        if (isNew) {
            div.classList.add('new-item');
            // Убираем класс после завершения анимации
            setTimeout(() => {
                div.classList.remove('new-item');
            }, 2000);
        }
        
        div.onclick = () => openNote(id);
div.innerHTML = `
${isNew ? '<img src="assets/new.png" class="new-badge-img">' : ''} <div style="width: 100%;">
    <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div style="display:flex; align-items:center; gap: 6px;">
                        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">${note.category}</div>
                        ${note.shop ? `<span class="shop-badge">${note.shop}</span>` : ""}
                    </div>
                    <div class="row-actions">
                        <button class="btn-copy" onclick="event.stopPropagation(); copyToClipboard('${id}')">
                          <span data-text-end="Скопировано!" data-text-initial="Скопировать список" class="cp-tooltip"></span>
                          <span>
                            <svg xml:space="preserve" style="enable-background:new 0 0 512 512" viewBox="0 0 6.35 6.35" y="0" x="0" height="20" width="20" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" xmlns="http://www.w3.org/2000/svg" class="cp-clipboard">
                              <g>
                                <path fill="currentColor" d="M2.43.265c-.3 0-.548.236-.573.53h-.328a.74.74 0 0 0-.735.734v3.822a.74.74 0 0 0 .735.734H4.82a.74.74 0 0 0 .735-.734V1.529a.74.74 0 0 0-.735-.735h-.328a.58.58 0 0 0-.573-.53zm0 .529h1.49c.032 0 .049.017.049.049v.431c0 .032-.017.049-.049.049H2.43c-.032 0-.05-.017-.05-.049V.843c0-.032.018-.05.05-.05zm-.901.53h.328c.026.292.274.528.573.528h1.49a.58.58 0 0 0 .573-.529h.328a.2.2 0 0 1 .206.206v3.822a.2.2 0 0 1-.206.205H1.53a.2.2 0 0 1-.206-.205V1.529a.2.2 0 0 1 .206-.206z"></path>
                              </g>
                            </svg>
                            <svg xml:space="preserve" style="enable-background:new 0 0 512 512" viewBox="0 0 24 24" y="0" x="0" height="18" width="18" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" xmlns="http://www.w3.org/2000/svg" class="cp-check-mark">
                              <g>
                                <path data-original="#000000" fill="currentColor" d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"></path>
                              </g>
                            </svg>
                          </span>
                        </button>
                        <button class="btn-action" style="background: var(--primary); color: white;" onclick="event.stopPropagation(); editNote('${id}')">✏️</button>
                        <button class="btn-action btn-del" onclick="event.stopPropagation(); deleteNote('${id}')">
                            <img src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png" class="icon-del">
                        </button>
                    </div>
                </div>
                <strong style="font-size: 17px; display: block; margin-bottom: 6px;">${note.items[0].text} ${note.items.length > 1 ? '(+' + (note.items.length-1) + ')' : ''}</strong>
                <div class="progress-text">${checkedCount} из ${note.items.length} КУПЛЕНО</div>
                <span class="author-badge">${note.date ? '📅 ' + note.date : ''}</span>
            </div>
        `;
        list.appendChild(div);
    });
    
}
    
   

function openNote(id) {
activeNoteId = id;
const note = (currentTab === 'todo' ? dataCache.todo : dataCache.done)[id];
if (!note) return;

const modalTitle = document.getElementById('modal-title');
modalTitle.innerText = "Состав списка";

// Удаляем старый блок метаданных, если он есть
const oldMeta = document.getElementById('modal-meta-box');
if (oldMeta) oldMeta.remove();

// Формируем новый блок метаданных в стиле дизайна приложения
const metaHtml = `
    <div id="modal-meta-box" class="modal-meta-container">
        <div class="meta-item">
            <span class="meta-label">📍 Категория:</span>
            <span>${note.category}</span>
        </div>
        ${note.shop ? `
        <div class="meta-item">
            <span class="meta-label">🛒 Магазин:</span>
            <span>${note.shop}</span>
        </div>` : ''}
        ${note.date ? `
        <div class="meta-item">
            <span class="meta-label">📅 Дата:</span>
            <span>${note.date}</span>
        </div>` : ''}
    </div>
`;

// Вставляем блок сразу после заголовка
modalTitle.insertAdjacentHTML('afterend', metaHtml);

// Очищаем и заполняем список товаров
const listDiv = document.getElementById('modal-items-list');
listDiv.innerHTML = '';
note.items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'check-item';
    div.innerHTML = `
        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleCheck(${idx}, this.checked)">
        <span class="${item.checked ? 'completed' : ''}">${item.text}</span>
    `;
    listDiv.appendChild(div);
});

document.getElementById('modal-actions').innerHTML = `
    <button class="main-btn" onclick="moveNote()">
        ${currentTab === 'todo' ? '✅ В архив' : '↩️ Вернуть'}
    </button>
`;

document.getElementById('modal').style.display = 'flex';
}

async function toggleCheck(idx, val) {
    const note = (currentTab === 'todo' ? dataCache.todo : dataCache.done)[activeNoteId];
    note.items[idx].checked = val;
    
    const section = currentTab === 'todo' ? 'todo' : 'done';
    const updatedData = { ...(currentTab === 'todo' ? dataCache.todo : dataCache.done) };
    updatedData[activeNoteId] = note;
    
    await saveData(section, updatedData);
}

async function moveNote() {
    const target = currentTab === 'todo' ? 'done' : 'todo';
    const data = (currentTab === 'todo' ? dataCache.todo : dataCache.done)[activeNoteId];
    
    // Добавляем в целевую секцию
    const newId = 'note_' + Date.now();
    const updatedTarget = { ...(target === 'todo' ? dataCache.todo : dataCache.done), [newId]: data };
    await saveData(target, updatedTarget);
    
    // Удаляем из текущей секции
    const updatedCurrent = { ...(currentTab === 'todo' ? dataCache.todo : dataCache.done) };
    delete updatedCurrent[activeNoteId];
    await saveData(currentTab, updatedCurrent);
    
    closeModal(null, 'modal');
    if (currentTab === 'todo') {
        showNotification('Список перемещен в архив', 'success');
    } else {
        showNotification('Список восстановлен', 'success');
    }
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-todo').classList.toggle('active', tab === 'todo');
    document.getElementById('tab-done').classList.toggle('active', tab === 'done');
    document.getElementById('tab-recipes').classList.toggle('active', tab === 'recipes');
    
    document.getElementById('input-card').style.display = tab === 'todo' ? 'block' : 'none';
    document.getElementById('recipe-card').style.display = tab === 'recipes' ? 'block' : 'none';
    document.getElementById('archive-actions').style.display = tab === 'done' ? 'block' : 'none';
    
    document.getElementById('shop-list').style.display = (tab === 'todo' || tab === 'done') ? 'block' : 'none';
    document.getElementById('recipe-list').style.display = tab === 'recipes' ? 'block' : 'none';
    
    if (tab === 'todo' || tab === 'done') {
        renderItems();
    } else if (tab === 'recipes') {
        renderRecipes();
    }
}

function copyToClipboard(id) {
const note = (currentTab === 'todo' ? dataCache.todo : dataCache.done)[id];

// Формируем заголовок с метаданными
let header = `📍 Категория: ${note.category}\n`;
if (note.shop) header += `🛒 Магазин: ${note.shop}\n`;
if (note.date) header += `📅 Дата: ${note.date}\n`;
header += `──────────────\n`;

// Собираем список товаров
const itemsText = note.items.map(i => `${i.checked ? '✅' : '▫️'} ${i.text}`).join('\n');

const fullText = header + itemsText;

navigator.clipboard.writeText(fullText).then(() => {
    tg.HapticFeedback.impactOccurred('medium');
});
}

async function clearArchive() {
    tg.showConfirm("Очистить архив?", async (ok) => {
        if (ok) {
            await saveData('done', {});
            showNotification('Архив очищен', 'success');
        }
    });
}

async function deleteNote(id) {
    tg.showConfirm("Удалить?", async (ok) => {
        if (ok) {
            const updatedData = { ...(currentTab === 'todo' ? dataCache.todo : dataCache.done) };
            delete updatedData[id];
            await saveData(currentTab, updatedData);
            showNotification('Список удален', 'success');
        }
    });
}

function closeModal(e, id) { if(!e || e.target.id === id) document.getElementById(id).style.display = 'none'; }

// Рецепты
document.getElementById('recipe-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('recipe-name').value.trim();
    const description = document.getElementById('recipe-description').value.trim();
    const ingredients = document.getElementById('recipe-ingredients').value.trim();
    
    if (!name) return;
    
    const ingredientsList = ingredients.split('\n').map(t => t.trim()).filter(t => t);
    
    const newId = 'recipe_' + Date.now();
    const updatedRecipes = {
        ...dataCache.recipes,
        [newId]: {
            name,
            description,
            ingredients: ingredientsList,
            author: myName,
            timestamp: Date.now()
        }
    };
    
    await saveData('recipes', updatedRecipes);
    
    e.target.reset();
    document.getElementById('recipe-description').style.height = '120px';
    document.getElementById('recipe-ingredients').style.height = '100px';
};

function renderRecipes() {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';
    const sortedKeys = Object.keys(dataCache.recipes).sort((a, b) => dataCache.recipes[b].timestamp - dataCache.recipes[a].timestamp);

    sortedKeys.forEach(id => {
        const recipe = dataCache.recipes[id];
        const div = document.createElement('div');
        div.className = 'item-row';
        div.onclick = () => openRecipe(id);
        div.innerHTML = `
            <div style="flex: 1;">
                <strong style="font-size: 17px; display: block; margin-bottom: 6px;">🍳 ${recipe.name}</strong>
                <div style="font-size: 13px; color: var(--text-secondary);">
                    ${recipe.ingredients.length} ингредиент${recipe.ingredients.length === 1 ? '' : recipe.ingredients.length < 5 ? 'а' : 'ов'}
                </div>
            </div>
            <button class="btn-action btn-del" onclick="event.stopPropagation(); deleteRecipe('${id}')">
                <img src="https://cdn-icons-png.flaticon.com/512/6861/6861362.png" class="icon-del">
            </button>
        `;
        list.appendChild(div);
    });
}

function openRecipe(id) {
    activeRecipeId = id;
    const recipe = dataCache.recipes[id];
    
    document.getElementById('recipe-modal-title').innerText = recipe.name;
    document.getElementById('recipe-modal-description').innerText = recipe.description || 'Описание не указано';
    
    const ingredientsDiv = document.getElementById('recipe-modal-ingredients');
    ingredientsDiv.innerHTML = '';
    
    recipe.ingredients.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'check-item';
        div.innerHTML = `<span>• ${item}</span>`;
        ingredientsDiv.appendChild(div);
    });
    
    document.getElementById('recipe-modal-actions').innerHTML = `
        <button class="main-btn" onclick="addRecipeToShopping()" style="background: var(--accent-green);">
            🛒 Добавить продукты в список покупок
        </button>
    `;
    
    document.getElementById('recipe-modal').style.display = 'flex';
}

async function addRecipeToShopping() {
    const recipe = dataCache.recipes[activeRecipeId];
    const items = recipe.ingredients.map(text => ({ text, checked: false }));
    
    const newId = 'note_' + Date.now();
    const updatedTodo = {
        ...dataCache.todo,
        [newId]: {
            items,
            category: "🍎 Продукты",
            shop: "",
            author: myName,
            timestamp: Date.now(),
            date: ""
        }
    };
    
    await saveData('todo', updatedTodo);
    closeModal(null, 'recipe-modal');
    showNotification(`Продукты из рецепта "${recipe.name}" добавлены в список`, 'success');
    switchTab('todo');
}

async function deleteRecipe(id) {
    tg.showConfirm("Удалить рецепт?", async (ok) => {
        if (ok) {
            const updatedRecipes = { ...dataCache.recipes };
            delete updatedRecipes[id];
            await saveData('recipes', updatedRecipes);
            showNotification('Рецепт удален', 'success');
        }
    });
}

// Редактирование списка покупок
function editNote(id) {
    activeNoteId = id;
    const note = (currentTab === 'todo' ? dataCache.todo : dataCache.done)[id];
    
    // Обновляем селекты категорий и магазинов
    updateEditCategorySelect();
    updateEditShopSelect();
    
    // Заполняем форму текущими данными
    document.getElementById('edit-category').value = note.category || '';
    document.getElementById('edit-shop').value = note.shop || '';
    document.getElementById('edit-date').value = note.date || '';
    document.getElementById('edit-items').value = note.items.map(i => i.text).join('\n');
    
    // Автоматически подстраиваем высоту textarea
    const textarea = document.getElementById('edit-items');
    textarea.style.height = "auto";
    textarea.style.height = (textarea.scrollHeight) + "px";
    
    document.getElementById('edit-modal').style.display = 'flex';
}

function updateEditCategorySelect() {
    const select = document.getElementById('edit-category');
    select.innerHTML = '';
    const defaultCats = ["🍎 Продукты", "🏠 Дом", "💊 Аптека", "👕 Одежда", "📦 Другое"];
    const hasDbCats = Object.keys(dataCache.categories).length > 0;
    if (!hasDbCats) defaultCats.forEach(c => select.add(new Option(c, c)));
    else Object.keys(dataCache.categories).forEach(id => select.add(new Option(dataCache.categories[id].name, dataCache.categories[id].name)));
}

function updateEditShopSelect() {
    const select = document.getElementById('edit-shop');
    select.innerHTML = '<option value="">🛒 Любой магазин</option>';
    Object.keys(dataCache.shops).forEach(id => select.add(new Option(dataCache.shops[id].name, dataCache.shops[id].name)));
}

document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const text = document.getElementById('edit-items').value.trim();
    if (!text) return;
    
    const items = text.split('\n').map(t => t.trim()).filter(t => t).map(text => {
        // Сохраняем статус checked если товар остался в списке
        const note = (currentTab === 'todo' ? dataCache.todo : dataCache.done)[activeNoteId];
        const existingItem = note.items.find(i => i.text === text);
        return { text, checked: existingItem ? existingItem.checked : false };
    });
    
    const updatedNote = {
        items,
        category: document.getElementById('edit-category').value,
        shop: document.getElementById('edit-shop').value,
        date: document.getElementById('edit-date').value,
        author: (currentTab === 'todo' ? dataCache.todo : dataCache.done)[activeNoteId].author,
        timestamp: (currentTab === 'todo' ? dataCache.todo : dataCache.done)[activeNoteId].timestamp
    };
    
    const section = currentTab === 'todo' ? 'todo' : 'done';
    const updatedData = { ...(currentTab === 'todo' ? dataCache.todo : dataCache.done) };
    updatedData[activeNoteId] = updatedNote;
    
    await saveData(section, updatedData);
    closeModal(null, 'edit-modal');
    showNotification('Список обновлен', 'success');
};