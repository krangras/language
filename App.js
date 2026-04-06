const { useState, useEffect, useRef, useCallback } = React;

// --- Иконки (упрощённые emoji вместо lucide для чистоты) ---
const Icon = ({ type, size = 20, className = "" }) => {
    const icons = {
        dashboard: "📊", f1: "🏎️", movies: "🎬", music: "🎸",
        dictionary: "📚", tutor: "💬", trophy: "🏆", zap: "⚡",
        volume: "🔊", refresh: "🔄", send: "📨", trash: "🗑️",
        star: "⭐", check: "✅", moon: "🌙", sun: "☀️"
    };
    return <span className={`inline-block ${className}`} style={{ fontSize: size }}>{icons[type] || "•"}</span>;
};

const App = () => {
    // --- Состояния ---
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('c1_active_tab') || 'dashboard');
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('c1_dark') === 'true');
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('c1_user');
        if (saved) return JSON.parse(saved);
        return { name: 'Nik', level: 'B1+', xp: 0, streak: 0, lastActive: new Date().toDateString() };
    });
    const [dictionary, setDictionary] = useState(() => {
        const saved = localStorage.getItem('c1_dict');
        return saved ? JSON.parse(saved) : [];
    });
    const [content, setContent] = useState(() => {
        const saved = localStorage.getItem('c1_content');
        if (saved) return JSON.parse(saved);
        return {
            f1: { title: "Drag Reduction System (DRS)", text: "DRS opens a flap on the rear wing, reducing drag and increasing straight-line speed by approximately 10-12 km/h. It's designed to promote overtaking, though purists argue it creates artificial racing.", vocab: ["Drag", "Overtaking", "Artificial"] },
            movies: { title: "The 'Bond Villain' Trope", text: "Classic Bond antagonists often exhibit physical deformities or eccentricities, symbolizing their moral corruption. This 'othering' technique creates psychological distance between the viewer and the villain's often sophisticated charm.", vocab: ["Antagonist", "Eccentricities", "Corruption"] },
            music: { title: "Emotional Catharsis in Post-Hardcore", text: "Bands like Annisokay use 'bleghs' and pitched screams not as noise, but as a linguistic tool to convey visceral frustration. The contrast between clean singing and harsh vocals mirrors internal conflict.", vocab: ["Catharsis", "Visceral", "Conflict"] }
        };
    });
    const [chatHistory, setChatHistory] = useState(() => {
        const saved = localStorage.getItem('c1_chat');
        return saved ? JSON.parse(saved) : [];
    });
    const [userQuery, setUserQuery] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [examMode, setExamMode] = useState(false);
    const [examQuestion, setExamQuestion] = useState(null);
    const [examAnswer, setExamAnswer] = useState('');
    const [examFeedback, setExamFeedback] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('c1_api_key') || '');
    const [showApiModal, setShowApiModal] = useState(false);

    // --- API конфиг (замени на свой, но можно оставить пустым — сайт работает без генерации) ---
    const GEMINI_KEY = apiKey; // https://aistudio.google.com/app/apikey

    // --- Сохранение всего в localStorage ---
    useEffect(() => {
        localStorage.setItem('c1_user', JSON.stringify(user));
        localStorage.setItem('c1_dict', JSON.stringify(dictionary));
        localStorage.setItem('c1_content', JSON.stringify(content));
        localStorage.setItem('c1_chat', JSON.stringify(chatHistory));
        localStorage.setItem('c1_active_tab', activeTab);
        localStorage.setItem('c1_dark', darkMode);
        if (apiKey) localStorage.setItem('c1_api_key', apiKey);
    }, [user, dictionary, content, chatHistory, activeTab, darkMode, apiKey]);

    // --- Обновление стрика при ежедневном входе ---
    useEffect(() => {
        const today = new Date().toDateString();
        if (user.lastActive !== today) {
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            const newStreak = user.lastActive === yesterday ? user.streak + 1 : 1;
            setUser(prev => ({ ...prev, streak: newStreak, lastActive: today }));
        }
    }, []);

    // --- TTS через Web Speech API (работает без ключа!) ---
    const speak = useCallback((text) => {
        if (isSpeaking) return;
        if (!window.speechSynthesis) {
            alert("Ваш браузер не поддерживает озвучку");
            return;
        }
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-GB';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }, [isSpeaking]);

    // --- Генерация нового контента через Gemini (если есть ключ) ---
    const generateNewContent = async (topic) => {
        if (!GEMINI_KEY) {
            alert("Добавь API ключ Gemini (кнопка ⚙️ в углу), чтобы генерировать свежие тексты. Или пользуйся готовыми.");
            return;
        }
        setLoading(true);
        const prompts = {
            f1: `Сгенерируй учебный текст на английском УРОВНЯ C1 (Upper-Advanced) на тему Формулы 1. Тема: любая техническая или тактическая (пит-стопы, шины, квалификация, инженерия). 
            Верни ТОЛЬКО JSON в точном формате: {"title": "короткий заголовок", "text": "текст 80-120 слов", "vocab": ["слово1", "слово2", "слово3"]}`,
            movies: `Сгенерируй учебный текст на английском УРОВНЯ C1 про Джеймса Бонда (актёр Дэниел Крейг). Анализ персонажа, сцены, британского стиля. 
            Верни JSON: {"title": "...", "text": "...", "vocab": ["...", "...", "..."]}`,
            music: `Сгенерируй учебный текст на английском УРОВНЯ C1 про группы Annisokay или Neck Deep. Анализ текстов песен, жанра пост-хардкор, эмоций.
            Верни JSON: {"title": "...", "text": "...", "vocab": ["...", "...", "..."]}`
        };
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompts[topic] }] }],
                    generationConfig: { temperature: 0.8, responseMimeType: "application/json" }
                })
            });
            const data = await res.json();
            const raw = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(raw);
            setContent(prev => ({ ...prev, [topic]: parsed }));
            setUser(prev => ({ ...prev, xp: prev.xp + 30 }));
        } catch (e) {
            console.error(e);
            alert("Ошибка генерации. Проверь API ключ или попробуй позже.");
        } finally {
            setLoading(false);
        }
    };

    // --- Добавление слова в словарь ---
    const addToDict = (word) => {
        if (!dictionary.some(d => d.word === word)) {
            setDictionary([...dictionary, { word, date: new Date().toLocaleDateString(), mastered: false }]);
            setUser(prev => ({ ...prev, xp: prev.xp + 5 }));
        }
    };
    const removeFromDict = (word) => setDictionary(dictionary.filter(d => d.word !== word));
    const markMastered = (word) => {
        setDictionary(dictionary.map(d => d.word === word ? { ...d, mastered: true } : d));
        setUser(prev => ({ ...prev, xp: prev.xp + 10 }));
    };

    // --- Чат с грамматическим разбором (исправлен handleSendMessage) ---
    const handleSendMessage = async () => {
        if (!userQuery.trim()) return;
        const userMsg = { role: 'user', text: userQuery };
        setChatHistory(prev => [...prev, userMsg]);
        setUserQuery('');

        if (!GEMINI_KEY) {
            setChatHistory(prev => [...prev, { role: 'bot', text: "⚠️ Добавь API ключ Gemini (кнопка ⚙️), чтобы я мог анализировать твои ошибки и переписывать текст на C1. Сейчас работаю в демо-режиме." }]);
            return;
        }

        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Ты — профессиональный репетитор английского (C1). 
                    Задача: проанализировать предложение пользователя, указать на грамматические/лексические ошибки, дать правильный вариант на уровне C1, объяснить почему.
                    Пользователь написал: "${userQuery}"
                    Ответь в формате:
                    🔍 Ошибки: (перечисли)
                    ✍️ Исправленный вариант (C1):
                    📚 Объяснение: (2-3 предложения)
                    `}]
                    }]
                })
            });
            const data = await res.json();
            const reply = data.candidates[0].content.parts[0].text;
            setChatHistory(prev => [...prev, { role: 'bot', text: reply }]);
            setUser(prev => ({ ...prev, xp: prev.xp + 15 }));
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'bot', text: "❌ Ошибка API. Проверь ключ или интернет." }]);
        }
    };

    // --- Экзамен по словарю ---
    const startExam = () => {
        if (dictionary.length === 0) {
            alert("Словарь пуст. Добавь слова из статей!");
            return;
        }
        const randomWord = dictionary[Math.floor(Math.random() * dictionary.length)];
        setExamQuestion(randomWord);
        setExamAnswer('');
        setExamFeedback('');
        setExamMode(true);
    };
    const checkExam = () => {
        if (!examAnswer.trim()) return;
        setExamFeedback(`✅ Записано! Слово "${examQuestion.word}" добавлено в активную практику. Используй его в следующих 3 диалогах.`);
        setUser(prev => ({ ...prev, xp: prev.xp + 20 }));
        setTimeout(() => { setExamMode(false); setExamQuestion(null); }, 2000);
    };

    // --- Компоненты ---
    const SidebarItem = ({ id, icon, label }) => (
        <button onClick={() => setActiveTab(id)} className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all ${activeTab === id ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white shadow-md') : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}`}>
            <Icon type={icon} /> <span className="font-semibold">{label}</span>
        </button>
    );

    const ContentCard = ({ type, data }) => (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} rounded-3xl p-8 border shadow-sm space-y-6`}>
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h3 className="text-2xl font-bold">{data.title}</h3>
                <div className="flex space-x-2">
                    <button onClick={() => speak(data.text)} disabled={isSpeaking} className={`p-2 rounded-full ${isSpeaking ? 'opacity-50' : (darkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600')}`}>
                        <Icon type="volume" />
                    </button>
                    <button onClick={() => generateNewContent(type)} disabled={loading} className={`p-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <span className={loading ? 'animate-spin inline-block' : ''}><Icon type="refresh" /></span>
                    </button>
                </div>
            </div>
            <p className={`text-lg leading-relaxed ${darkMode ? 'text-gray-200' : 'text-slate-600'}`}>{data.text}</p>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Vocabulary (click to save)</p>
                <div className="flex flex-wrap gap-2 mt-3">
                    {data.vocab.map(v => (
                        <button key={v} onClick={() => addToDict(v)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg text-sm font-medium transition">
                            {v}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // --- Рендер ---
    return (
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-[#f8fafc] text-slate-900'} font-sans`}>
            {/* Шапка с тогглом темы и API ключом */}
            <div className="sticky top-0 z-20 backdrop-blur-md bg-opacity-80 bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <span className="text-2xl">🏎️</span>
                    <h1 className="font-black text-xl">C1 PULSE — {user.name}</h1>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{user.level}</span>
                </div>
                <div className="flex space-x-3">
                    <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <Icon type={darkMode ? "sun" : "moon"} />
                    </button>
                    <button onClick={() => setShowApiModal(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-sm">🔑</button>
                    <div className="flex items-center space-x-1 text-sm font-bold">
                        <span>⭐ {user.xp}</span>
                        <span className="ml-2">🔥 {user.streak}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row">
                {/* Sidebar десктоп */}
                <aside className="hidden lg:block w-72 p-6 space-y-2 border-r dark:border-gray-800">
                    <SidebarItem id="dashboard" icon="dashboard" label="Дашборд" />
                    <SidebarItem id="f1" icon="f1" label="Formula 1" />
                    <SidebarItem id="movies" icon="movies" label="James Bond" />
                    <SidebarItem id="music" icon="music" label="Annisokay / Neck Deep" />
                    <SidebarItem id="dictionary" icon="dictionary" label="Мой словарь" />
                    <SidebarItem id="tutor" icon="tutor" label="AI Тьютор" />
                    <button onClick={startExam} className="w-full mt-8 bg-gradient-to-r from-green-500 to-teal-500 text-white p-3 rounded-xl font-bold">📝 Экзамен по словарю</button>
                </aside>

                {/* Основной контент */}
                <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 overflow-y-auto max-h-[calc(100vh-60px)]">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
                                    <p className="text-sm text-gray-500">Твой уровень</p>
                                    <p className="text-3xl font-black">{user.level}</p>
                                    <div className="h-2 w-full bg-gray-200 rounded-full mt-2"><div className="h-full bg-blue-500 rounded-full w-[35%]"></div></div>
                                </div>
                                <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
                                    <p className="text-sm text-gray-500">Слова в словаре</p>
                                    <p className="text-3xl font-black">{dictionary.length}</p>
                                </div>
                                <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
                                    <p className="text-sm text-gray-500">Серия (дней)</p>
                                    <p className="text-3xl font-black">{user.streak} 🔥</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div onClick={() => setActiveTab('f1')} className="bg-red-600 p-6 rounded-3xl text-white cursor-pointer hover:scale-[1.02] transition">🏎️ F1 Engineering</div>
                                <div onClick={() => setActiveTab('movies')} className="bg-slate-800 p-6 rounded-3xl text-white cursor-pointer hover:scale-[1.02] transition">🎬 Bond Analysis</div>
                                <div onClick={() => setActiveTab('music')} className="bg-purple-600 p-6 rounded-3xl text-white cursor-pointer hover:scale-[1.02] transition">🎸 Annisokay / Neck Deep</div>
                            </div>
                            <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white border'}`}>
                                <h3 className="font-bold text-xl mb-3">Ежедневный челлендж</h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-4">Напиши 3 предложения о своей последней тренировке, используя слова из словаря.</p>
                                <textarea rows="2" className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600" placeholder="I hit a plateau on bench press, but I'm determined to break through..."></textarea>
                                <button className="mt-3 bg-blue-600 text-white px-6 py-2 rounded-xl">Отправить (+15 XP)</button>
                            </div>
                        </div>
                    )}

                    {['f1', 'movies', 'music'].includes(activeTab) && <ContentCard type={activeTab} data={content[activeTab]} />}

                    {activeTab === 'dictionary' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center flex-wrap"><h2 className="text-2xl font-black">📖 Мой словарь ({dictionary.length})</h2><button onClick={startExam} className="bg-green-600 text-white px-4 py-2 rounded-xl">Начать экзамен</button></div>
                            {dictionary.length === 0 && <p className="text-gray-500">Сохраняй слова из статей — они появятся здесь.</p>}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {dictionary.map(item => (
                                    <div key={item.word} className={`p-4 rounded-xl border flex justify-between items-center ${item.mastered ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : (darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white')}`}>
                                        <div><span className="font-bold text-lg">{item.word}</span><p className="text-xs text-gray-400">{item.date}</p></div>
                                        <div className="flex space-x-2">
                                            <button onClick={() => speak(item.word)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Icon type="volume" size={16} /></button>
                                            {!item.mastered && <button onClick={() => markMastered(item.word)} className="p-2 text-green-600">✅</button>}
                                            <button onClick={() => removeFromDict(item.word)} className="p-2 text-red-500"><Icon type="trash" size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tutor' && (
                        <div className={`h-[70vh] flex flex-col rounded-2xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                            <div className="p-4 border-b dark:border-gray-700 font-bold">💬 AI Грамматический тьютор (C1 Coach)</div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {chatHistory.length === 0 && <p className="text-gray-400 text-center mt-10">Напиши предложение — я исправлю его до C1 и объясню ошибки.</p>}
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-gray-700' : 'bg-gray-100')}`}>{msg.text}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t dark:border-gray-700 flex space-x-2">
                                <input type="text" value={userQuery} onChange={e => setUserQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} placeholder="I go to gym yesterday → исправь меня..." className={`flex-1 p-3 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`} />
                                <button onClick={handleSendMessage} className="bg-blue-600 text-white p-3 rounded-xl"><Icon type="send" /></button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Мобильное меню */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t dark:border-gray-800 flex justify-around p-3 z-30">
                {['dashboard', 'f1', 'movies', 'music', 'dictionary', 'tutor'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`p-2 rounded-full ${activeTab === tab ? 'text-blue-600' : 'text-gray-500'}`}>
                        <Icon type={{ dashboard: '📊', f1: '🏎️', movies: '🎬', music: '🎸', dictionary: '📚', tutor: '💬' }[tab]} />
                    </button>
                ))}
            </div>

            {/* Модалка API ключа */}
            {showApiModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 max-w-md w-full`}>
                        <h3 className="text-xl font-bold mb-2">🔑 API ключ Gemini</h3>
                        <p className="text-sm text-gray-500 mb-4">Вставь ключ с <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500">Google AI Studio</a> (бесплатно). Без ключа генерация текстов и AI-тьютор не работают, но TTS и словарь работают.</p>
                        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={`w-full p-3 border rounded-xl ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`} placeholder="AIza..." />
                        <div className="flex justify-end space-x-3 mt-6">
                            <button onClick={() => setShowApiModal(false)} className="px-4 py-2 rounded-xl border">Закрыть</button>
                            <button onClick={() => setShowApiModal(false)} className="bg-blue-600 text-white px-4 py-2 rounded-xl">Сохранить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модалка экзамена */}
            {examMode && examQuestion && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold">📝 Вспомни перевод слова</h3>
                        <p className="text-3xl font-black my-6 text-center">{examQuestion.word}</p>
                        <input type="text" value={examAnswer} onChange={e => setExamAnswer(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Твой ответ (на русском или английском)" autoFocus />
                        <div className="flex justify-end space-x-3 mt-6">
                            <button onClick={() => setExamMode(false)} className="px-4 py-2 rounded-xl border">Отмена</button>
                            <button onClick={checkExam} className="bg-green-600 text-white px-4 py-2 rounded-xl">Проверить</button>
                        </div>
                        {examFeedback && <p className="mt-4 text-green-600">{examFeedback}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Рендер в DOM ---
ReactDOM.createRoot(document.getElementById('root')).render(<App />);