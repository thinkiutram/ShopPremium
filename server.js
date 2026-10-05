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

// 1. Schema Người dùng
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// 2. Schema Giao dịch (Chống nạp trùng)
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

// Khóa bảo mật Webhook (Trùng khớp cấu hình trên SePay)
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

// =======================================================
// CỔNG WEBHOOK TỰ ĐỘNG CỘNG TIỀN (CHUẨN SEPAY & DIRECT)
// =======================================================
app.post('/api/webhook/bank', async (req, res) => {
    try {
        // Hỗ trợ mọi kiểu truyền Header Authorization từ SePay
        const authHeader = req.headers['authorization'] || '';
        const apiKeyHeader = req.headers['x-api-key'] || '';

        const isValid = authHeader === `Apikey ${SEPAY_API_KEY}` || 
                        authHeader === SEPAY_API_KEY || 
                        apiKeyHeader === SEPAY_API_KEY;

        if (!isValid) {
            console.log('[SEPAY] Từ chối: Sai mã xác thực Header!');
            return res.status(403).json({ success: false, message: "Sai mã xác thực Webhook!" });
        }

        const data = req.body;
        console.log('[SEPAY NHẬN DỮ LIỆU]:', JSON.stringify(data));

        // Nhận diện linh hoạt trường từ gói tin SePay
        const transactionId = String(data.id || data.transactionId || data.referenceCode || Date.now());
        const amount = Number(data.transferAmount || data.amount || 0);
        const description = data.content || data.description || '';

        // Phục vụ nút gửi Test của SePay (Gói test thường chưa có tiền hoặc nội dung nạp)
        if (!amount || !description) {
            return res.status(200).json({ success: true, message: "Kiểm tra kết nối Webhook thành công!" });
        }

        // Chống lặp giao dịch
        const isExisted = await Transaction.findOne({ transactionId });
        if (isExisted) {
            return res.status(200).json({ success: true, message: "Giao dịch này đã được ghi nhận trước đó" });
        }

        // Bóc tách cú pháp: nap thinh, napthinh, hoặc nap+thinh
        const match = description.match(/nap[\s\+]*([a-zA-Z0-9_]+)/i);
        if (!match) {
            return res.status(200).json({ success: false, message: "Nội dung chuyển khoản không chứa cú pháp nạp" });
        }

        const username = match[1].toLowerCase();

        // Tìm kiếm tài khoản trong MongoDB
        const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (!user) {
            return res.status(200).json({ success: false, message: `Không tìm thấy tài khoản: ${username}` });
        }

        // Tự động cộng tiền và lưu lịch sử
        user.balance += amount;
        await user.save();

        await Transaction.create({
            transactionId,
            amount,
            username: user.username,
            description
        });

        console.log(`[SEPAY THÀNH CÔNG] Tài khoản: ${user.username} | +${amount}đ | Mã GD: ${transactionId}`);
        return res.status(200).json({ success: true, message: `Đã cộng ${amount}đ cho tài khoản ${user.username}` });

    } catch (err) {
        console.error("Lỗi xử lý Webhook:", err);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
    }
});

app.listen(PORT, () => {
    console.log(`Shop Premium đang chạy tại cổng ${PORT}`);
});
