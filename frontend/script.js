// script.js

const API_BASE_URL = 'http://localhost:3000'; // 您的後端伺服器位址



// --- 會員登入狀態管理 ---
function isLoggedIn() {
    return localStorage.getItem('userId') !== null;
}

function getUserId() {
    return localStorage.getItem('userId');
}

function getUsername() {
    return localStorage.getItem('username');
}

function setLoginState(userId, username) {
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', username);
    updateNavbar();
}

function clearLoginState() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    updateNavbar();
}

function updateNavbar() {
    const body = document.body;
    if (isLoggedIn()) {
        body.setAttribute('data-logged-in', 'true');
        const usernameSpan = document.getElementById('navbar-username');
        if (usernameSpan) {
            usernameSpan.textContent = getUsername();
        }
    } else {
        body.setAttribute('data-logged-in', 'false');
    }
}

// --- 顯示訊息的輔助函數 ---
function showMessage(elementId, message, type = 'success') {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000); // 5秒後隱藏訊息
    }
}

// --- 購物車功能 (簡單的本地儲存) ---
// 注意: 這是簡化的購物車，商品僅存在於用戶的瀏覽器 localStorage
// 實際的電子商務網站會有更複雜的伺服器端購物車管理
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(product) {
    // 新增：在加入購物車前檢查登入狀態
    if (!isLoggedIn()) {
        alert('請先登入才能將商品加入購物車！');
        window.location.href = 'auth.html'; // 導向登入/註冊頁面
        return; // 終止函數執行
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    saveCart();
    alert(`${product.name} 已加入購物車！`);
    console.log('當前購物車:', cart);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart(); // 重新渲染購物車頁面
}

function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, newQuantity); // 數量至少為1
        saveCart();
        renderCart();
    }
}

// --- 導航列功能 ---
function setupNavbar() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearLoginState();
            alert('您已登出！');
            // 導向首頁或登入頁
            window.location.href = 'index.html';
        });
    }
    updateNavbar(); // 初始化導航列狀態
}

// *** 新增/確保這個函數在 script.js 中作為全局函數 ***
function updateCartCountDisplay() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCountSpan = document.getElementById('cart-count');
    if (cartCountSpan) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountSpan.textContent = totalItems;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupNavbar();
    updateCartCountDisplay(); // 確保每次頁面載入都會更新購物車數量顯示
});

