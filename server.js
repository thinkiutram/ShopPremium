const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = 80;

// Chuỗi kết nối MongoDB Atlas của bạn
const MONGO_URI = "mongodb+srv://upes2470691_db_user:nIlZJMrW6gqEG9Wq@cluster0.qudzknz.mongodb.net/ShopPremium?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Ket noi MongoDB thanh cong!'))
    .catch(err => console.error('Loi ket noi MongoDB:', err));

// Cấu trúc bảng User trong Database
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Đăng ký lưu vào Database
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

// API Đăng nhập kiểm tra từ Database
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

app.listen(PORT, () => {
    console.log(`Shop Premium dang chay tai port ${PORT}`);
});
