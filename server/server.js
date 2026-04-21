const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { db, runQuery, getAll, getOne, initDatabase, insertSampleData } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
    secret: 'golos-goroda-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, 
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 
    }
}));


app.use((req, res, next) => {
    const blockedPrefixes = ['/server/', '/node_modules/', '/tools/', '/.git/'];
    if (blockedPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return res.status(404).end();
    }
    next();
});

app.use(express.static(path.join(__dirname, '..')));


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый формат файла'));
        }
    }
});




const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация'
        });
    }
    next();
};


const requireAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация'
        });
    }
    if (req.session.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещён'
        });
    }
    next();
};


const CATEGORIES = [
    'Парки и скверы',
    'Транспорт',
    'Дороги',
    'Дворы и детские площадки',
    'Освещение',
    'Экология',
    'Образование',
    'Здравоохранение',
    'Культура и спорт',
    'Другое'
];




app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все поля'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Пароль должен быть не менее 6 символов'
            });
        }

        
        const existingUser = await getOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Пользователь с таким email уже существует'
            });
        }

        
        const passwordHash = await bcrypt.hash(password, 10);

        
        const result = await runQuery(
            `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`,
            [email.toLowerCase(), passwordHash, name]
        );

        res.status(201).json({
            success: true,
            message: 'Регистрация успешна'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Ошибка при регистрации' });
    }
});


app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Введите email и пароль'
            });
        }

        
        const user = await getOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }

        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }

        
        req.session.userId = user.id;
        req.session.role = user.role;

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar_url: user.avatar_url,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Ошибка при входе' });
    }
});


app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Ошибка при выходе' });
        }
        res.json({ success: true, message: 'Вы вышли из системы' });
    });
});


app.get('/api/auth/me', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ success: true, data: null });
        }

        const user = await getOne('SELECT id, email, name, surname, phone, avatar_url, role FROM users WHERE id = ?', [req.session.userId]);

        res.json({
            success: true,
            data: user || null
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении данных пользователя' });
    }
});


app.put('/api/auth/profile', requireAuth, async (req, res) => {
    try {
        const { name, surname, phone, avatar_url } = req.body;
        const userId = req.session.userId;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Имя обязательно'
            });
        }

        await runQuery(
            `UPDATE users SET name = ?, surname = ?, phone = ?, avatar_url = ? WHERE id = ?`,
            [name, surname || '', phone || '', avatar_url || 'images/default-avatar.svg', userId]
        );

        const updatedUser = await getOne('SELECT id, email, name, surname, phone, avatar_url, role FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении профиля' });
    }
});




app.get('/api/categories', (req, res) => {
    res.json({ success: true, data: CATEGORIES });
});


app.get('/api/ideas', async (req, res) => {
    try {
        const { status, category, sort } = req.query;

        let sql = `
            SELECT ideas.*, users.name as author_name, users.avatar_url as author_avatar 
            FROM ideas 
            LEFT JOIN users ON ideas.user_id = users.id
            WHERE 1=1
        `;
        const params = [];

        
        if (status) {
            sql += ' AND ideas.status = ?';
            params.push(status);
        } else {
            sql += ' AND ideas.status = ?';
            params.push('approved');
        }

        
        if (category) {
            sql += ' AND ideas.category = ?';
            params.push(category);
        }

        
        switch (sort) {
            case 'votes':
                sql += ' ORDER BY ideas.votes_count DESC';
                break;
            case 'oldest':
                sql += ' ORDER BY ideas.created_at ASC';
                break;
            default:
                sql += ' ORDER BY ideas.created_at DESC';
        }

        const ideas = await getAll(sql, params);

        
        let votedIds = new Set();
        if (req.session.userId) {
            const votedIdeas = await getAll(
                'SELECT idea_id FROM votes WHERE user_id = ?',
                [req.session.userId]
            );
            votedIds = new Set(votedIdeas.map(v => v.idea_id));
        }

        const ideasWithVoteStatus = ideas.map(idea => ({
            ...idea,
            hasVoted: votedIds.has(idea.id)
        }));

        res.json({ success: true, data: ideasWithVoteStatus });
    } catch (error) {
        console.error('Error fetching ideas:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении идей' });
    }
});


app.get('/api/ideas/:id', async (req, res) => {
    try {
        const idea = await getOne(`
            SELECT ideas.*, users.name as author_name, users.avatar_url as author_avatar 
            FROM ideas 
            LEFT JOIN users ON ideas.user_id = users.id
            WHERE ideas.id = ?
        `, [req.params.id]);

        if (!idea) {
            return res.status(404).json({ success: false, error: 'Идея не найдена' });
        }

        
        let hasVoted = false;
        if (req.session.userId) {
            const vote = await getOne(
                'SELECT id FROM votes WHERE idea_id = ? AND user_id = ?',
                [req.params.id, req.session.userId]
            );
            hasVoted = !!vote;
        }

        res.json({
            success: true,
            data: {
                ...idea,
                hasVoted
            }
        });
    } catch (error) {
        console.error('Error fetching idea:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении идеи' });
    }
});


app.post('/api/ideas', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const { title, category, description } = req.body;
        const userId = req.session.userId;

        
        if (!title || !category || !description) {
            return res.status(400).json({
                success: false,
                error: 'Пожалуйста, заполните все обязательные поля'
            });
        }

        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                error: 'Недопустимая категория'
            });
        }

        const filePath = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await runQuery(
            `INSERT INTO ideas (title, category, description, file_path, user_id, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [title, category, description, filePath, userId]
        );

        res.status(201).json({
            success: true,
            message: 'Ваша идея отправлена на модерацию',
            data: { id: result.lastID }
        });
    } catch (error) {
        console.error('Error creating idea:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании идеи' });
    }
});


app.post('/api/vote', requireAuth, async (req, res) => {
    try {
        const { ideaId } = req.body;
        const userId = req.session.userId;

        if (!ideaId) {
            return res.status(400).json({
                success: false,
                error: 'ID идеи не указан'
            });
        }

        
        const idea = await getOne('SELECT * FROM ideas WHERE id = ?', [ideaId]);

        if (!idea) {
            return res.status(404).json({
                success: false,
                error: 'Идея не найдена'
            });
        }

        if (idea.status !== 'approved') {
            return res.status(400).json({
                success: false,
                error: 'Голосование по этой идее недоступно'
            });
        }

        
        const existingVote = await getOne(
            'SELECT id FROM votes WHERE idea_id = ? AND user_id = ?',
            [ideaId, userId]
        );

        if (existingVote) {
            return res.status(400).json({
                success: false,
                error: 'Вы уже голосовали за эту идею'
            });
        }

        
        await runQuery(
            'INSERT INTO votes (idea_id, user_id) VALUES (?, ?)',
            [ideaId, userId]
        );

        
        await runQuery(
            'UPDATE ideas SET votes_count = votes_count + 1 WHERE id = ?',
            [ideaId]
        );

        
        const updated = await getOne('SELECT votes_count FROM ideas WHERE id = ?', [ideaId]);

        res.json({
            success: true,
            message: 'Ваш голос учтён!',
            data: { votesCount: updated.votes_count }
        });
    } catch (error) {
        console.error('Error voting:', error);
        res.status(500).json({ success: false, error: 'Ошибка при голосовании' });
    }
});


app.get('/api/user/ideas', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        const ideas = await getAll(`
            SELECT * FROM ideas WHERE user_id = ? ORDER BY created_at DESC
        `, [userId]);

        res.json({ success: true, data: ideas });
    } catch (error) {
        console.error('Error fetching user ideas:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении идей' });
    }
});


app.get('/api/stats', async (req, res) => {
    try {
        const total = await getOne('SELECT COUNT(*) as count FROM ideas WHERE status IN (?, ?)', ['approved', 'implemented']);
        const voting = await getOne('SELECT COUNT(*) as count FROM ideas WHERE status = ?', ['approved']);
        const implemented = await getOne('SELECT COUNT(*) as count FROM ideas WHERE status = ?', ['implemented']);
        const totalVotes = await getOne('SELECT SUM(votes_count) as count FROM ideas WHERE status IN (?, ?)', ['approved', 'implemented']);

        res.json({
            success: true,
            data: {
                totalIdeas: total.count || 0,
                activeVoting: voting.count || 0,
                implemented: implemented.count || 0,
                totalVotes: totalVotes.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении статистики' });
    }
});




app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const notifications = await getAll(`
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [userId]);

        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении уведомлений' });
    }
});


app.get('/api/notifications/count', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const result = await getOne(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );

        res.json({ success: true, data: { count: result.count || 0 } });
    } catch (error) {
        console.error('Error fetching notifications count:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении количества уведомлений' });
    }
});


app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const notificationId = req.params.id;

        await runQuery(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );

        res.json({ success: true, message: 'Уведомление отмечено как прочитанное' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении уведомления' });
    }
});


app.put('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        await runQuery(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [userId]
        );

        res.json({ success: true, message: 'Все уведомления отмечены как прочитанные' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении уведомлений' });
    }
});




app.get('/api/admin/ideas', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;

        let sql = `
            SELECT ideas.*, users.name as author_name, users.email as author_email
            FROM ideas 
            LEFT JOIN users ON ideas.user_id = users.id
        `;
        const params = [];

        if (status) {
            sql += ' WHERE ideas.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY ideas.created_at DESC';

        const ideas = await getAll(sql, params);
        res.json({ success: true, data: ideas });
    } catch (error) {
        console.error('Error fetching admin ideas:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении идей' });
    }
});


app.put('/api/admin/ideas/:id/approve', requireAdmin, async (req, res) => {
    try {
        const ideaId = req.params.id;

        const idea = await getOne('SELECT * FROM ideas WHERE id = ?', [ideaId]);
        if (!idea) {
            return res.status(404).json({ success: false, error: 'Идея не найдена' });
        }

        await runQuery('UPDATE ideas SET status = ? WHERE id = ?', ['approved', ideaId]);

        
        await runQuery(
            `INSERT INTO notifications (user_id, type, message, idea_id) VALUES (?, ?, ?, ?)`,
            [idea.user_id, 'idea_approved', `Ваша идея "${idea.title}" была опубликована!`, ideaId]
        );

        res.json({
            success: true,
            message: 'Идея одобрена и опубликована'
        });
    } catch (error) {
        console.error('Error approving idea:', error);
        res.status(500).json({ success: false, error: 'Ошибка при одобрении идеи' });
    }
});


app.put('/api/admin/ideas/:id/reject', requireAdmin, async (req, res) => {
    try {
        const ideaId = req.params.id;

        const idea = await getOne('SELECT * FROM ideas WHERE id = ?', [ideaId]);
        if (!idea) {
            return res.status(404).json({ success: false, error: 'Идея не найдена' });
        }

        await runQuery('UPDATE ideas SET status = ? WHERE id = ?', ['rejected', ideaId]);

        
        await runQuery(
            `INSERT INTO notifications (user_id, type, message, idea_id) VALUES (?, ?, ?, ?)`,
            [idea.user_id, 'idea_rejected', `Ваша идея "${idea.title}" была отклонена`, ideaId]
        );

        res.json({
            success: true,
            message: 'Идея отклонена'
        });
    } catch (error) {
        console.error('Error rejecting idea:', error);
        res.status(500).json({ success: false, error: 'Ошибка при отклонении идеи' });
    }
});


app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || 'Внутренняя ошибка сервера' });
});


initDatabase()
    .then(() => insertSampleData())
    .then(() => {
        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ГОЛОС ГОРОДА - Civic Engagement Platform            ║
║                                                       ║
║   Server running at: http://localhost:${PORT}            ║
║                                                       ║
║   Demo accounts:                                      ║
║   Admin: admin@golosgoroda.ru / admin123              ║
║   User:  demo@golosgoroda.ru / demo123                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
            `);
        });
    })
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
