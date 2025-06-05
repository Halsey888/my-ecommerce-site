// 載入環境變數
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors');

// 設定 Express 應用程式使用 JSON 格式的請求體
app.use(express.json());
app.use(cors()); // <-- 放在 express.json() 之後

const jwt = require('jsonwebtoken'); // 新增：用於產生和驗證Token (需要 npm install jsonwebtoken)

// 安全考慮：在實際應用中，JWT_SECRET 應儲存在 .env 檔案中，且為複雜字串
const JWT_SECRET = process.env.JWT_SECRET || '金色閃光`';

// 簡易的管理員驗證中間件
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // 獲取 Bearer Token

    if (!token) {
        return res.status(401).json({ message: '未提供授權 Token' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token 無效或過期' });
        }
        // 確保是管理員用戶 (這裡假設 userId 1 是管理員)
        if (user.userId !== 1) { // 假設用戶ID為1的是管理員，您可以修改此邏輯
            return res.status(403).json({ message: '無管理員權限' });
        }
        req.user = user; // 將用戶資訊附加到請求對象上
        next();
    });
};

// -----------------------------------------------------------
// 資料庫連線設定
// -----------------------------------------------------------
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

let pool; // 定義連線池變數

async function connectToDatabase() {
    try {
        // 建立資料庫連線池
        pool = await mysql.createPool(dbConfig);
        console.log('成功連接到 MySQL 資料庫！');
    } catch (error) {
        console.error('連接資料庫失敗:', error.message);
        process.exit(1); // 連接失敗就結束應用程式
    }
}

// 啟動應用程式時連接資料庫
connectToDatabase();

// -----------------------------------------------------------
// 路由 (API endpoints)
// -----------------------------------------------------------

// 根目錄路由
app.get('/', (req, res) => {
    res.send('歡迎來到您的電子商務後端！');
});

// -----------------------------------------------------------
// 商品相關 API
// -----------------------------------------------------------

// 取得所有商品列表
// 取得所有商品列表 (現在支持按分類篩選)
app.get('/products', async (req, res) => {
    const { category } = req.query; // 從查詢參數中獲取 category

    let query = 'SELECT * FROM products';
    const queryParams = [];

    if (category && category !== 'all') { // 如果提供了分類，且不是 'all'
        query += ' WHERE category = ?';
        queryParams.push(category);
    }
    query += ' ORDER BY id ASC'; // 保持排序

    try {
        const [rows] = await pool.query(query, queryParams);
        res.json(rows);
    } catch (error) {
        console.error('獲取商品列表失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// 取得單一商品詳情
app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: '商品未找到' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('獲取商品詳情失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// 管理員登入 API (新增)
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    // 這裡我們硬編碼一個管理員帳號和密碼，實際應用中應從資料庫查詢
    const ADMIN_USERNAME = 'jackliu';
    const ADMIN_PASSWORD = 'Sdfegfr123`'; // 在實際應用中，這個密碼也應該是雜湊的

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // 生成 JWT Token
        const token = jwt.sign({ userId: 1, username: ADMIN_USERNAME, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ message: '管理員登入成功！', token: token });
    } else {
        return res.status(401).json({ message: '管理員用戶名或密碼不正確' });
    }
});

// -----------------------------------------------------------
// 會員認證相關 API
// -----------------------------------------------------------

// 會員註冊
app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ message: '請提供完整的用戶名、密碼和電子郵件' });
    }

    try {
        // 檢查用戶名或電子郵件是否已存在
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: '用戶名或電子郵件已存在' });
        }

        // 雜湊密碼
        const hashedPassword = await bcrypt.hash(password, 10); // 10 是鹽值 (salt) 的複雜度

        // 插入新用戶
        await pool.query('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email]);
        res.status(201).json({ message: '註冊成功！' });

    } catch (error) {
        console.error('註冊失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// 會員登入
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '請提供用戶名和密碼' });
    }

    try {
        // 查找用戶
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: '用戶名或密碼不正確' });
        }

        const user = users[0];

        // 比對密碼
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: '用戶名或密碼不正確' });
        }

        // 登入成功，通常會回傳一個 JWT token，這裡為了簡單只回傳用戶 ID
        res.json({ message: '登入成功！', userId: user.id, username: user.username });

    } catch (error) {
        console.error('登入失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// -----------------------------------------------------------
// 購物車與訂單相關 API (這裡實現簡單的訂購流程，沒有真實的購物車狀態儲存)
// -----------------------------------------------------------

// 建立新訂單 (模擬購物車結帳)
// 請求體預期格式: { userId: 1, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] }
app.post('/orders', async (req, res) => {
    const { userId, items } = req.body;

    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: '請提供有效的 userId 和訂單商品列表' });
    }

    let connection; // 定義連線變數，以便在 finally 區塊中釋放
    try {
        connection = await pool.getConnection(); // 從連線池中獲取一個連線
        await connection.beginTransaction(); // 開始事務

        let totalAmount = 0;
        const orderItemsToInsert = [];

        // 驗證商品庫存並計算總金額
        for (const item of items) {
            const [products] = await connection.query('SELECT id, price, stock FROM products WHERE id = ?', [item.productId]);
            if (products.length === 0) {
                throw new Error(`商品 ID: ${item.productId} 不存在`);
            }
            const product = products[0];

            if (product.stock < item.quantity) {
                throw new Error(`商品 ${product.name} 庫存不足，目前僅剩 ${product.stock} 件`);
            }

            totalAmount += product.price * item.quantity;
            orderItemsToInsert.push({
                productId: product.id,
                quantity: item.quantity,
                price: product.price // 記錄下單時的商品價格
            });

            // 更新商品庫存
            await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);
        }

        // 插入訂單主表
        const [orderResult] = await connection.query('INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)', [userId, totalAmount, 'pending']);
        const orderId = orderResult.insertId;

        // 插入訂單明細
        for (const item of orderItemsToInsert) {
            await connection.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [orderId, item.productId, item.quantity, item.price]);
        }

        await connection.commit(); // 提交事務
        res.status(201).json({ message: '訂單建立成功！', orderId: orderId, totalAmount: totalAmount });

    } catch (error) {
        if (connection) {
            await connection.rollback(); // 發生錯誤時回滾事務
        }
        console.error('建立訂單失敗:', error.message);
        res.status(500).json({ message: error.message || '伺服器內部錯誤' });
    } finally {
        if (connection) {
            connection.release(); // 釋放連線回連線池
        }
    }
});

// 查詢會員的所有訂單
app.get('/users/:userId/orders', async (req, res) => {
    const { userId } = req.params;
    try {
        const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC', [userId]);
        res.json(orders);
    } catch (error) {
        console.error('查詢用戶訂單失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// 查詢單一訂單的詳細內容 (包含商品資訊)
app.get('/orders/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orderRows.length === 0) {
            return res.status(404).json({ message: '訂單未找到' });
        }

        const [itemRows] = await pool.query(`
            SELECT oi.*, p.name AS product_name, p.image_url
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);

        const order = {
            ...orderRows[0],
            items: itemRows
        };
        res.json(order);
    } catch (error) {
        console.error('查詢訂單詳情失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// -----------------------------------------------------------
// 管理員專用 API (受 authenticateAdmin 保護)
// -----------------------------------------------------------

// 獲取所有商品 (用於管理員視圖，可能包含更多細節)
app.get('/admin/products', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        console.error('管理員獲取商品列表失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// 更新商品庫存 (管理員操作)
app.put('/admin/products/:id/stock', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { newStock } = req.body;

    if (typeof newStock !== 'number' || newStock < 0) {
        return res.status(400).json({ message: '請提供有效的庫存數量 (非負數字)' });
    }

    try {
        const [result] = await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '商品未找到或庫存未更改' });
        }
        res.json({ message: `商品 ID: ${id} 庫存已更新為 ${newStock}` });
    } catch (error) {
        console.error('更新商品庫存失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    }
});

// 新增商品 (管理員操作)
app.post('/admin/products', authenticateAdmin, async (req, res) => {
    const { name, description, price, stock, image_url, category } = req.body;

    // 簡單的輸入驗證
    if (!name || !price || typeof price !== 'number' || price <= 0 ||
        !stock || typeof stock !== 'number' || stock < 0) {
        return res.status(400).json({ message: '請提供有效的商品名稱、價格 (大於0的數字) 和庫存 (非負數字)。' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO products (name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?)',
            [name, description, price, stock, image_url, category || '其他'] // 如果沒有提供 category，預設為 '其他'
        );
        res.status(201).json({ message: '商品新增成功！', productId: result.insertId });
    } catch (error) {
        console.error('新增商品失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤或商品名稱重複' }); // 可能是名稱重複
    }
});

// **新增：刪除商品 (管理員操作)**
app.delete('/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 檢查該商品是否在任何訂單中
        const [orderItems] = await connection.query('SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?', [id]);
        if (orderItems[0].count > 0) {
            // 如果商品存在於訂單中，通常不允許直接刪除，而是標記為「下架」或「隱藏」
            // 這裡為了演示直接刪除，但在實際應用中應避免
            // 或者，您可以選擇刪除相關的訂單明細（如果業務邏輯允許），但這可能會破壞訂單歷史
            // 或者更優雅地更新商品狀態，例如 SET is_active = FALSE
            console.warn(`商品 ID: ${id} 存在於訂單中，但仍將被刪除。建議在實際環境中避免此操作或更新商品狀態。`);
            // return res.status(400).json({ message: '無法刪除商品，因為它已存在於歷史訂單中。請考慮將其下架。' });
        }

        // 刪除商品
        const [result] = await connection.query('DELETE FROM products WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: '商品未找到' });
        }

        await connection.commit();
        res.json({ message: `商品 ID: ${id} 已成功刪除。` });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('刪除商品失敗:', error.message);
        res.status(500).json({ message: '伺服器內部錯誤' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// -----------------------------------------------------------
// 啟動伺服器
// -----------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
});