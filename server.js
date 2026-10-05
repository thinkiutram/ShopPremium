const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = 80;

// Chuỗi kết nối MongoDB Atlas
const MONGO_URI = "mongodb+srv://upes2470691_db_user:nIlZJMrW6gqEG9Wq@cluster0.qudzknz.mongodb.net/ShopPremium?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Ket noi MongoDB thanh cong!'))
    .catch(err => console.error('Loi ket noi MongoDB:', err));

// 1. Bảng User
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// 2. Bảng Lịch sử giao dịch (Chống nạp trùng)
const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    username: { type: String, required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mã bí mật cấu hình trên SePay (API Key)
const SEPAY_API_KEY = "ShopPremium_Secret_2026";

// API Đăng ký
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
        }
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.json({ success: false, message: "Tài khoản đã tồn tại!" });
        }
        const newUser = new User({ username, password, balance: 0 });
        await newUser.save();
        res.json({ success: true, message: "Đăng ký thành công!" });
    } catch (err) {
        res.json({ success: false, message: "Lỗi hệ thống khi đăng ký!" });
    }
});

// API Đăng nhập
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (user) {
            res.json({ success: true, message: "Đăng nhập thành công!", username: user.username, balance: user.balance });
        } else {
            res.json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu!" });
        }
    } catch (err) {
        res.json({ success: false, message: "Lỗi hệ thống khi đăng nhập!" });
    }
});

// API Lấy số dư mới nhất
app.get('/api/user/balance', async (req, res) => {
    try {
        const { username } = req.query;
        const user = await User.findOne({ username });
        if (user) {
            res.json({ success: true, balance: user.balance });
        } else {
            res.json({ success: false, message: "Không tìm thấy người dùng" });
        }
    } catch (err) {
        res.json({ success: false, message: "Lỗi hệ thống!" });
    }
});

// ==========================================
// CỔNG WEBHOOK NHẬN DỮ LIỆU TỪ SEPAY
// ==========================================
app.post('/api/webhook/bank', async (req, res) => {
    try {
        // Kiểm tra xác thực SePay (Hỗ trợ cả header Apikey lẫn x-api-key)
        const authHeader = req.headers['authorization'] || '';
        const apiKeyHeader = req.headers['x-api-key'] || '';

        const isValid = authHeader === `Apikey ${SEPAY_API_KEY}` || 
                        authHeader === SEPAY_API_KEY || 
                        apiKeyHeader === SEPAY_API_KEY;

        if (!isValid) {
            console.log('[SEPAY] Tu choi: Sai ma xac thuc!');
            return res.status(403).json({ success: false, message: "Sai mã xác thực Webhook!" });
        }

        const data = req.body;
        console.log('[SEPAY DATA NHAN DUOC]:', JSON.stringify(data));

        // Lấy thông tin giao dịch từ SePay (Hỗ trợ linh hoạt các trường)
        const transactionId = String(data.id || data.transactionId || data.referenceCode || Date.now());
        const amount = Number(data.transferAmount || data.amount || 0);
        const description = data.content || data.description || '';

        if (!amount || !description) {
            return res.json({ success: false, message: "Thiếu số tiền hoặc nội dung giao dịch" });
        }

        // Chống cộng tiền trùng lặp giao dịch
        const isExisted = await Transaction.findOne({ transactionId });
        if (isExisted) {
            return res.json({ success: false, message: "Giao dịch này đã được cộng trước đó!" });
        }

        // Nhận diện cú pháp: nap thinh, napthinh hoặc nap+thinh
        const match = description.match(/nap[\s\+]*([a-zA-Z0-9_]+)/i);
        if (!match) {
            return res.json({ success: false, message: "Nội dung chuyển khoản không có cú pháp nạp" });
        }

        const username = match[1].toLowerCase();

        // Tìm tài khoản
        const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (!user) {
            return res.json({ success: false, message: `Không tìm thấy tài khoản: ${username}` });
        }

        // Tự động cộng tiền và ghi log
        user.balance += amount;
        await user.save();

        await Transaction.create({
            transactionId,
            amount,
            username: user.username,
            description
        });

        console.log(`[SEPAY THANH CONG] User: ${user.username} | +${amount}d | Ma GD: ${transactionId}`);
        return res.json({ success: true, message: `Đã cộng ${amount}đ cho tài khoản ${user.username}` });

    } catch (err) {
        console.error("Lỗi Webhook SePay:", err);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
    }
});

app.listen(PORT, () => {
    console.log(`Shop Premium dang chay tai port ${PORT}`);
});
