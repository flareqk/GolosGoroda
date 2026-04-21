const sqlite3 = require('sqlite3').verbose();
const path = require('path');


const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);


const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const getAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};


const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            
            db.run('PRAGMA foreign_keys = ON');

            
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    surname TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    avatar_url TEXT DEFAULT 'images/default-avatar.svg',
                    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            
            db.run(`
                CREATE TABLE IF NOT EXISTS ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    description TEXT NOT NULL,
                    file_path TEXT,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'implemented')),
                    votes_count INTEGER DEFAULT 0,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            
            db.run(`
                CREATE TABLE IF NOT EXISTS votes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    idea_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(idea_id, user_id)
                )
            `);

            
            db.run(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    idea_id INTEGER,
                    is_read INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
                )
            `);

            
            db.run('CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status)');
            db.run('CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category)');
            db.run('CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_votes_idea ON votes(idea_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');

            
            db.run(`ALTER TABLE users ADD COLUMN surname TEXT DEFAULT ''`, (err) => {
                
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Migration error (surname):', err.message);
                }
            });
            db.run(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''`, (err) => {
                
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Migration error (phone):', err.message);
                }
                resolve();
            });
        });
    });
};


const insertSampleData = async () => {
    const bcrypt = require('bcryptjs');

    
    const adminExists = await getOne('SELECT id FROM users WHERE email = ?', ['admin@golosgoroda.ru']);

    if (!adminExists) {
        
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        await runQuery(
            `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
            ['admin@golosgoroda.ru', adminPasswordHash, 'Администратор', 'admin']
        );
        console.log('✓ Admin user created (admin@golosgoroda.ru / admin123)');

        
        const demoPasswordHash = await bcrypt.hash('demo123', 10);
        const demoResult = await runQuery(
            `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`,
            ['demo@golosgoroda.ru', demoPasswordHash, 'Демо Пользователь']
        );
        const demoUserId = demoResult.lastID;
        console.log('✓ Demo user created (demo@golosgoroda.ru / demo123)');

        
        const sampleIdeas = [
            
            {
                title: 'Благоустройство парка "Солнечный"',
                category: 'Парки и скверы',
                description: 'Предлагаю установить новые скамейки и урны в парке "Солнечный". Текущие находятся в плохом состоянии и не соответствуют современным стандартам комфорта для граждан.',
                status: 'implemented',
                votes: 142
            },
            {
                title: 'Велодорожка на улице Центральной',
                category: 'Транспорт',
                description: 'Необходимо создать велодорожку на улице Центральной для безопасного передвижения велосипедистов. Это снизит загруженность дорог и улучшит экологию района.',
                status: 'implemented',
                votes: 189
            },
            {
                title: 'Детская площадка во дворе дома №15',
                category: 'Дворы и детские площадки',
                description: 'Во дворе дома №15 по улице Мира отсутствует детская площадка. Просим рассмотреть возможность установки современного игрового комплекса для детей.',
                status: 'implemented',
                votes: 256
            },
            {
                title: 'Освещение в микрорайоне "Западный"',
                category: 'Освещение',
                description: 'В микрорайоне "Западный" недостаточное уличное освещение. Необходимо установить дополнительные фонари для безопасности жителей в тёмное время суток.',
                status: 'implemented',
                votes: 167
            },
            {
                title: 'Ремонт спортивной площадки на ул. Советской',
                category: 'Спорт',
                description: 'Спортивная площадка требует капитального ремонта: новое покрытие, ворота, сетки на баскетбольных кольцах.',
                status: 'implemented',
                votes: 203
            },

            
            {
                title: 'Установка контейнеров для раздельного сбора мусора',
                category: 'Экология',
                description: 'Предлагаю установить контейнеры для раздельного сбора мусора возле каждого многоквартирного дома. Это важный шаг к экологичному городу.',
                status: 'approved',
                votes: 187
            },
            {
                title: 'Ремонт тротуаров на улице Ленина',
                category: 'Дороги',
                description: 'Тротуары на улице Ленина в ужасном состоянии. Много выбоин и трещин, опасно для пешеходов, особенно для пожилых людей.',
                status: 'approved',
                votes: 234
            },
            {
                title: 'Создание зоны отдыха у реки',
                category: 'Парки и скверы',
                description: 'Предлагаю обустроить зону отдыха на берегу реки: беседки, скамейки, дорожки для прогулок.',
                status: 'approved',
                votes: 312
            },
            {
                title: 'Расширение парковки у торгового центра',
                category: 'Транспорт',
                description: 'Парковка постоянно переполнена, необходимо расширить её хотя бы на 50 мест.',
                status: 'approved',
                votes: 178
            },
            {
                title: 'Организация пункта проката велосипедов',
                category: 'Спорт',
                description: 'Установить автоматизированный пункт проката велосипедов в центре города для развития велокультуры.',
                status: 'approved',
                votes: 145
            },
            {
                title: 'Ремонт фасада здания библиотеки',
                category: 'Культура',
                description: 'Фасад исторического здания библиотеки требует срочного ремонта и покраски.',
                status: 'approved',
                votes: 98
            },
            {
                title: 'Установка камер видеонаблюдения во дворах',
                category: 'Безопасность',
                description: 'Для повышения безопасности предлагаю установить камеры видеонаблюдения во всех дворах микрорайона.',
                status: 'approved',
                votes: 267
            },
            {
                title: 'Создание бесплатного WiFi в парках',
                category: 'Технологии',
                description: 'Предлагаю организовать бесплатный доступ к интернету в городских парках и скверах.',
                status: 'approved',
                votes: 421
            },
            {
                title: 'Благоустройство сквера у школы №5',
                category: 'Парки и скверы',
                description: 'Сквер возле школы №5 нуждается в благоустройстве: новые лавочки, клумбы, детская зона.',
                status: 'approved',
                votes: 192
            },
            {
                title: 'Ремонт дорожного покрытия на ул. Гагарина',
                category: 'Дороги',
                description: 'Участок дороги на улице Гагарина между домами 10 и 20 в критическом состоянии.',
                status: 'approved',
                votes: 156
            },

            
            {
                title: 'Установка фонтана на центральной площади',
                category: 'Благоустройство',
                description: 'Предлагаю установить декоративный фонтан с подсветкой на главной площади города.',
                status: 'pending',
                votes: 0
            },
            {
                title: 'Организация фермерского рынка по выходным',
                category: 'Торговля',
                description: 'Создать площадку для фермерского рынка, где местные производители смогут продавать свою продукцию.',
                status: 'pending',
                votes: 0
            },
            {
                title: 'Строительство крытого катка',
                category: 'Спорт',
                description: 'Предлагаю построить крытый каток для круглогодичного использования.',
                status: 'pending',
                votes: 0
            },
            {
                title: 'Создание центра культуры и досуга',
                category: 'Культура',
                description: 'Необходим современный центр культуры с залом для мероприятий на 300 человек.',
                status: 'pending',
                votes: 0
            },
            {
                title: 'Озеленение промзоны',
                category: 'Экология',
                description: 'Высадить деревья и кустарники вдоль промышленной зоны для улучшения экологии.',
                status: 'pending',
                votes: 0
            }
        ];

        for (const idea of sampleIdeas) {
            await runQuery(
                `INSERT INTO ideas (title, category, description, status, votes_count, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
                [idea.title, idea.category, idea.description, idea.status, idea.votes, demoUserId]
            );
        }

        console.log('✓ Sample ideas inserted (5 implemented, 10 approved, 5 pending)');
    }
};

module.exports = {
    db,
    runQuery,
    getAll,
    getOne,
    initDatabase,
    insertSampleData
};
