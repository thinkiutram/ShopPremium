const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 80;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cho phép thư mục 'public' hiển thị tĩnh ra bên ngoài
app.use(express.static(path.join(__dirname, 'public')));

let users = [];

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
    }
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.json({ success: false, message: "Tài khoản đã tồn tại!" });
    }
    users.push({ username, password, balance: 0 });
    res.json({ success: true, message: "Đăng ký thành công!" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, message: "Đăng nhập thành công!", username: user.username, balance: user.balance });
    } else {
        res.json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu!" });
    }
});

app.listen(PORT, () => {
    console.log(`Shop Premium dang chay tai port ${PORT}`);
});
