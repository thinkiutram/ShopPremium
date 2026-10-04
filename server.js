const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Database tạm lưu trong RAM
let users = {};

// API Đăng ký
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.json({success: false, message: 'Thiếu thông tin!'});
    if(users[username]) return res.json({success: false, message: 'Tên đăng nhập đã tồn tại!'});
    users[username] = { password, balance: 0 };
    res.json({success: true, message: 'Đăng ký thành công!'});
});

// API Đăng nhập
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if(users[username] && users[username].password === password) {
        res.json({success: true, balance: users[username].balance});
    } else {
        res.json({success: false, message: 'Sai tài khoản hoặc mật khẩu!'});
    }
});

// Giao diện Web trực tiếp
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SMM Shop Premium</title>
<style>
:root{--bg:#0b0e14;--card:#151a23;--primary:#3b82f6;--text:#fff;--text-dim:#94a3b8}
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
body{background:var(--bg);color:var(--text);padding:16px}
.hidden{display:none!important}
.auth-box{background:var(--card);border-radius:12px;padding:20px;margin-top:40px;box-shadow:0 4px 12px rgba(0,0,0,0.5)}
.tab{display:flex;background:#1e293b;border-radius:8px;margin-bottom:20px;padding:4px}
.tab-btn{flex:1;padding:12px;text-align:center;border-radius:6px;font-weight:bold;color:var(--text-dim);cursor:pointer}
.tab-btn.active{background:var(--primary);color:#fff}
input{width:100%;background:#0b0e14;border:1px solid #334155;color:#fff;padding:14px;border-radius:8px;outline:none;margin-bottom:15px;font-size:15px}
input:focus{border-color:var(--primary)}
.btn{width:100%;background:var(--primary);color:#fff;border:none;padding:14px;border-radius:8px;font-weight:bold;font-size:15px;cursor:pointer}
.header{display:flex;justify-content:space-between;align-items:center;background:var(--card);padding:16px;border-radius:12px;margin-bottom:20px}
.badge{background:#1e293b;color:var(--primary);padding:6px 12px;border-radius:20px;font-weight:bold}
.deposit{background:var(--card);padding:16px;border-radius:12px}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #334155}
.row:last-child{border-bottom:none}
</style>
</head>
<body>

<div id="auth-screen">
    <h2 style="text-align:center;margin-bottom:10px">Shop Premium</h2>
    <div class="auth-box">
        <div class="tab">
            <div class="tab-btn active" id="t-login" onclick="setMode('login')">Đăng Nhập</div>
            <div class="tab-btn" id="t-reg" onclick="setMode('reg')">Đăng Ký</div>
        </div>
        <input type="text" id="user" placeholder="Tên đăng nhập">
        <input type="password" id="pass" placeholder="Mật khẩu">
        <button class="btn" id="btn-action" onclick="submitAuth()">Đăng Nhập</button>
    </div>
</div>

<div id="app-screen" class="hidden">
    <div class="header">
        <div>
            <div id="wel" style="font-weight:bold;font-size:16px"></div>
            <div style="font-size:12px;color:var(--text-dim);margin-top:2px">Hệ thống tự động</div>
        </div>
        <div class="badge"><span id="bal">0</span> đ</div>
    </div>

    <div class="deposit">
        <h3 style="margin-bottom:12px">🏦 Nạp Tiền Chuyển Khoản</h3>
        <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">Chuyển khoản chính xác nội dung để hệ thống cộng tiền tự động.</p>
        <div class="row"><span style="color:var(--text-dim)">Ngân hàng</span><strong>ACB</strong></div>
        <div class="row"><span style="color:var(--text-dim)">Chủ TK</span><strong>NGUYỄN HƯNG THỊNH</strong></div>
        <div class="row"><span style="color:var(--text-dim)">Số TK</span><strong style="color:#3b82f6">20113961</strong></div>
        <div class="row"><span style="color:var(--text-dim)">Nội dung</span><strong style="color:#ef4444" id="content-code">NAP user</strong></div>
    </div>
    <button class="btn" style="background:#ef4444;margin-top:20px" onclick="logout()">Đăng Xuất</button>
</div>

<script>
let isLogin = true;
function setMode(m) {
    isLogin = (m === 'login');
    document.getElementById('t-login').className = isLogin ? 'tab-btn active' : 'tab-btn';
    document.getElementById('t-reg').className = !isLogin ? 'tab-btn active' : 'tab-btn';
    document.getElementById('btn-action').innerText = isLogin ? 'Đăng Nhập' : 'Đăng Ký';
}

async function submitAuth() {
    let u = document.getElementById('user').value.trim();
    let p = document.getElementById('pass').value.trim();
    if(!u || !p) return alert('Nhập đủ thông tin đi bạn!');
    
    let ep = isLogin ? '/api/login' : '/api/register';
    let r = await fetch(ep, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u, password:p})});
    let d = await r.json();
    
    if(!isLogin) {
        alert(d.message);
        if(d.success) setMode('login');
    } else {
        if(d.success) {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-screen').classList.remove('hidden');
            document.getElementById('wel').innerText = 'Xin chào, ' + u;
            document.getElementById('bal').innerText = d.balance.toLocaleString('vi-VN');
            document.getElementById('content-code').innerText = 'NAP ' + u;
        } else {
            alert(d.message);
        }
    }
}

function logout() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('pass').value = '';
}
</script>
</body>
</html>`);
});

app.listen(80, () => console.log('Shop chay thanh cong!'));
