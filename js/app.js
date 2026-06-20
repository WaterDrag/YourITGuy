import { initializeApp }                         from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                                  from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc, serverTimestamp, query, orderBy, where }
                                                  from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { firebaseConfig }                         from './firebase-config.js';
import emailjs                                    from 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm';

// ── EmailJS config ────────────────────────────────────────────
// Zaregistruj se na emailjs.com, přidej Gmail službu a vytvoř šablonu
// Pak sem doplň svoje hodnoty:
const EMAILJS_SERVICE_ID  = 'service_8sh2b33';
const EMAILJS_TEMPLATE_ID = 'template_oyz347j';
const EMAILJS_PUBLIC_KEY  = 'GY-py_nH6Qm2ZuXRl';

const emailjsReady = !EMAILJS_PUBLIC_KEY.startsWith('VLOZ');
if (emailjsReady) emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// ── Init ─────────────────────────────────────────────────────
let app, auth, db, firebaseReady = false;

try {
    app  = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db   = getFirestore(app);
    firebaseReady = firebaseConfig.apiKey !== 'VLOZ_SVUJ_API_KEY';
} catch (e) {
    console.warn('Firebase není nakonfigurován — web běží v demo módu.');
}

const ADMIN_EMAIL = 'zitkatomik007@gmail.com';

// ── Výchozí obsah ─────────────────────────────────────────────
const DEFAULT_SERVICES = [
    {
        id: 'it',
        icon: '💻',
        title: 'IT Služby',
        shortDesc: 'Opravy, nastavení, vzdálená podpora. Vyřeším váš IT problém rychle a bez zbytečných komplikací.',
        longDesc: 'Nabízím komplexní IT podporu pro domácnosti i malé firmy. Pomáhám s nastavením počítačů, sítí a tiskáren. Řeším problémy s hardwarem i softwarem, instaluji programy, odstraňuji viry a malware.',
        features: ['Oprava a nastavení PC a notebooků', 'Instalace a konfigurace softwaru', 'Odstraňování virů a malware', 'Nastavení sítě a Wi-Fi', 'Vzdálená podpora'],
        priceFrom: '200 Kč / hod',
        badge: ''
    },
    {
        id: '3d',
        icon: '🖨️',
        title: '3D Tisk na míru',
        shortDesc: 'FDM tisk z PLA, PETG nebo ABS. Váš model nebo nápad — já ho vytisknu.',
        longDesc: 'Tisknu na FDM tiskárně v materiálech PLA, PETG a ABS. Ideální pro prototypy, náhradní díly, dekorace nebo cokoliv co potřebujete. Pokud nemáte 3D model, pomohu vám s jeho navržením.',
        features: ['FDM tisk: PLA, PETG, ABS', 'Tisk dle vašeho .stl / .obj souboru', 'Pomoc s návrhem modelu', 'Prototypy, náhradní díly, dekorace', 'Vícebarevný tisk'],
        priceFrom: '50 Kč / výtisk',
        badge: 'Oblíbené'
    },
    {
        id: 'web',
        icon: '🌐',
        title: 'Webové stránky',
        shortDesc: 'Moderní, rychlý a responzivní web. Portfolio, landing page nebo firemní prezentace.',
        longDesc: 'Tvořím moderní webové stránky přizpůsobené vašim potřebám. Každý web je responzivní (funguje na mobilu i PC), rychlý a profesionálně vypadající. Nabízím také správu a hosting.',
        features: ['Responzivní design (mobil i PC)', 'Portfolio, landing page, firemní web', 'Správa a hosting webu', 'Základní SEO optimalizace', 'Možnost e-shopu'],
        priceFrom: '500 Kč',
        badge: ''
    }
];

const DEFAULT_HERO = {
    line1: 'Vyřeším IT, vytisknu',
    line2: 'co potřebujete,\nebo postavím web.',
    sub: 'Jsem freelancer z ČR. Nabízím IT podporu, 3D tisk na míru a tvorbu webových stránek. Rychle, poctivě a za rozumnou cenu.'
};

const DEFAULT_ABOUT = {
    heading: 'Jsem freelancer\nkterý to opravdu umí',
    text: 'Zabývám se IT službami, 3D tiskem a tvorbou webů. Mám praktické zkušenosti a přistupuji ke každému projektu individuálně. Pracuji rychle, komunikuji jasně a platíte až po dodání výsledku.'
};

// ── Stav ──────────────────────────────────────────────────────
let isAdmin        = false;
let currentUser    = null;
let services       = [...DEFAULT_SERVICES];
let pendingEditFn  = null;
let editingSvcId   = null;

// ── Auth ──────────────────────────────────────────────────────
window.handleLogin = async () => {
    if (!firebaseReady) { showToast('Nejdřív nastav Firebase config.', 'error'); return; }
    if (currentUser) return;
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user') showToast('Přihlášení selhalo.', 'error');
    }
};

window.handleLogout = async () => {
    if (auth) await signOut(auth);
};

if (firebaseReady) {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        isAdmin     = user?.email === ADMIN_EMAIL;
        updateAuthUI();
        if (isAdmin) loadInquiryBadge();
    });
}

function updateAuthUI() {
    const loginBtn   = document.getElementById('loginBtn');
    const adminBar   = document.getElementById('adminBar');
    const myInqBtn   = document.getElementById('myInqBtn');
    const isLoggedIn = !!currentUser;

    // Login button — avatar písmeno nebo ikona
    if (isLoggedIn) {
        const initial = (currentUser.displayName || currentUser.email || '?')[0].toUpperCase();
        loginBtn.innerHTML = `<span style="font-size:0.85rem;font-weight:700">${initial}</span>`;
        loginBtn.title     = currentUser.email;
        loginBtn.onclick   = handleLogout;
    } else {
        loginBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        loginBtn.title     = 'Přihlásit se';
        loginBtn.onclick   = handleLogin;
    }

    loginBtn.classList.toggle('is-admin', isAdmin);
    loginBtn.classList.toggle('is-user', isLoggedIn && !isAdmin);

    // Admin bar
    if (isAdmin) {
        adminBar.style.display = 'block';
        document.body.classList.add('admin-active');
        document.querySelectorAll('.service-edit-btn').forEach(b => b.style.display = 'block');
    } else {
        adminBar.style.display = 'none';
        document.body.classList.remove('admin-active');
        document.querySelectorAll('.service-edit-btn').forEach(b => b.style.display = 'none');
    }

    // Tlačítko "Moje poptávky" — jen pro přihlášené ne-adminy
    if (myInqBtn) myInqBtn.style.display = (isLoggedIn && !isAdmin) ? 'flex' : 'none';
}

// ── Načtení obsahu ────────────────────────────────────────────
async function loadContent() {
    if (!firebaseReady) { renderServices(); renderAbout(); return; }

    try {
        const [svcSnap, aboutSnap, heroSnap] = await Promise.all([
            getDoc(doc(db, 'siteContent', 'services')),
            getDoc(doc(db, 'siteContent', 'about')),
            getDoc(doc(db, 'siteContent', 'hero'))
        ]);

        if (svcSnap.exists())   services = svcSnap.data().list;
        if (aboutSnap.exists()) renderAboutData(aboutSnap.data());
        if (heroSnap.exists())  renderHeroData(heroSnap.data());
    } catch (e) {
        console.warn('Načítání obsahu selhalo:', e.message);
    }

    renderServices();
    renderAbout();
}

// ── Render: Služby ────────────────────────────────────────────
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = services.map(s => `
        <article class="service-card" onclick="showService('${s.id}')" role="button" tabindex="0"
                 onkeydown="if(event.key==='Enter')showService('${s.id}')">
            ${s.badge ? `<span class="service-badge">${escHtml(s.badge)}</span>` : ''}
            <button class="service-edit-btn" style="display:${isAdmin ? 'block' : 'none'}"
                    onclick="event.stopPropagation();editService('${s.id}')">✏️ Upravit</button>
            <span class="service-icon">${s.icon}</span>
            <h3>${escHtml(s.title)}</h3>
            <p class="service-desc">${escHtml(s.shortDesc)}</p>
            <ul class="service-features">
                ${s.features.slice(0, 4).map(f => `<li>${escHtml(f)}</li>`).join('')}
            </ul>
            <div class="service-footer">
                <div class="service-price">od <strong>${escHtml(s.priceFrom)}</strong></div>
                <span class="service-cta">Více info →</span>
            </div>
        </article>
    `).join('');
}

// ── Render: About ─────────────────────────────────────────────
function renderAbout() { renderAboutData(DEFAULT_ABOUT); }

function renderAboutData(data) {
    const [l1, l2] = (data.heading || '').split('\n');
    const h = document.getElementById('aboutHeading');
    if (h) h.innerHTML = `${escHtml(l1 || '')}<br><span class="gradient-text">${escHtml(l2 || '')}</span>`;
    const t = document.getElementById('aboutText');
    if (t) t.textContent = data.text || '';
}

// ── Render: Hero ──────────────────────────────────────────────
function renderHeroData(data) {
    const h = document.getElementById('heroTitle');
    if (h) h.innerHTML = `${escHtml(data.line1 || '')}<br><span class="gradient-text">${escHtml(data.line2 || '')}</span>`;
    const s = document.getElementById('heroSub');
    if (s) s.textContent = data.sub || '';
}

// ── Detail služby ─────────────────────────────────────────────
window.showService = id => {
    const s = services.find(x => x.id === id);
    if (!s) return;

    const inp = document.getElementById('inp-service');
    if (inp) inp.value = id;

    document.getElementById('svc-title').textContent = s.title;
    document.getElementById('serviceModalContent').innerHTML = `
        <span class="sm-icon">${s.icon}</span>
        <p class="sm-desc">${escHtml(s.longDesc)}</p>
        <ul class="sm-features">${s.features.map(f => `<li>${escHtml(f)}</li>`).join('')}</ul>
        <div class="sm-price">
            <span class="sm-price-label">Cena od</span>
            <span class="sm-price-val">${escHtml(s.priceFrom)}</span>
        </div>
    `;
    openModal('serviceModal');
};

// ── Kontaktní formulář ────────────────────────────────────────
window.submitInquiry = async e => {
    e.preventDefault();
    const btn  = document.getElementById('submitBtn');
    const txt  = document.getElementById('submitText');
    const spin = document.getElementById('submitSpinner');
    const msg  = document.getElementById('formMsg');

    btn.disabled = true;
    txt.style.display  = 'none';
    spin.style.display = 'inline-block';
    msg.textContent = '';
    msg.className   = 'form-msg';

    const data = {
        name:    document.getElementById('inp-name').value.trim(),
        email:   document.getElementById('inp-email').value.trim(),
        service: document.getElementById('inp-service').value,
        message: document.getElementById('inp-message').value.trim(),
    };

    try {
        if (!firebaseReady) throw new Error('Firebase není nakonfigurován. Napiš mi přímo na email.');
        await addDoc(collection(db, 'inquiries'), { ...data, createdAt: serverTimestamp(), status: 'new' });

        // Pošli emailovou notifikaci
        if (emailjsReady) {
            const svcLabel = { it: 'IT Služby', '3d': '3D Tisk', web: 'Webové stránky', other: 'Jiné' };
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                from_name:    data.name,
                from_email:   data.email,
                service_name: svcLabel[data.service] || 'Nevybráno',
                message:      data.message,
                to_email:     'zitkatomik007@gmail.com',
            });
        }

        msg.textContent = '✓ Poptávka odeslána! Ozvu se do 24 hodin.';
        msg.className   = 'form-msg success';
        document.getElementById('contactForm').reset();
        showToast('Poptávka úspěšně odeslána!', 'success');
    } catch (err) {
        msg.textContent = '✗ ' + err.message;
        msg.className   = 'form-msg error';
    } finally {
        btn.disabled       = false;
        txt.style.display  = 'inline';
        spin.style.display = 'none';
    }
};

// ── Admin: Poptávky ───────────────────────────────────────────
const SVC_LABELS = { it: 'IT Služby', '3d': '3D Tisk', web: 'Webové stránky', other: 'Jiné' };

window.showInquiries = async () => {
    openModal('inquiriesModal');
    const list = document.getElementById('inquiriesList');
    list.innerHTML = '<p class="inquiry-empty">Načítám...</p>';

    try {
        const snap = await getDocs(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')));

        if (snap.empty) {
            list.innerHTML = '<p class="inquiry-empty">Žádné poptávky zatím 🎉</p>';
            return;
        }

        list.innerHTML = snap.docs.map(d => {
            const it  = d.data();
            const dt  = it.createdAt?.toDate?.()?.toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) || '—';
            const isN = it.status === 'new';
            return `
                <div class="inquiry-item ${isN ? 'is-new' : ''}" id="inq-${d.id}">
                    <div class="inquiry-meta">
                        <span class="inquiry-name">${escHtml(it.name)}</span>
                        <span class="inquiry-date">${dt}</span>
                    </div>
                    <div class="inquiry-email">${escHtml(it.email)}</div>
                    ${it.service ? `<span class="inquiry-svc">${SVC_LABELS[it.service] || it.service}</span>` : ''}
                    <p class="inquiry-msg">${escHtml(it.message)}</p>
                    <div class="inquiry-actions">
                        <button class="inq-btn reply" onclick="replyInquiry('${escAttr(it.email)}','${escAttr(it.name)}')">✉️ Odpovědět</button>
                        ${isN
                            ? `<button class="inq-btn read-btn" onclick="markRead('${d.id}')">Označit přečteno</button>`
                            : `<span class="inq-read-label">✓ Přečteno</span>`}
                    </div>
                </div>`;
        }).join('');

        // Refresh badge
        const newCnt = snap.docs.filter(d => d.data().status === 'new').length;
        updateInquiryBadge(newCnt);

    } catch (err) {
        list.innerHTML = `<p class="inquiry-empty" style="color:var(--error)">${err.message}</p>`;
    }
};

window.markRead = async id => {
    try {
        await updateDoc(doc(db, 'inquiries', id), { status: 'read' });
        const el = document.getElementById('inq-' + id);
        if (!el) return;
        el.classList.remove('is-new');
        const btn = el.querySelector('.read-btn');
        if (btn) { const lbl = document.createElement('span'); lbl.className = 'inq-read-label'; lbl.textContent = '✓ Přečteno'; btn.replaceWith(lbl); }
        await loadInquiryBadge();
    } catch (err) { showToast(err.message, 'error'); }
};

window.replyInquiry = (email, name) => {
    location.href = `mailto:${email}?subject=Re%3A+Va%C5%A1e+popt%C3%A1vka&body=Dobr%C3%BD+den+${encodeURIComponent(name)}%2C%0A%0A`;
};

// ── User: Moje poptávky ───────────────────────────────────────
window.showMyInquiries = async () => {
    if (!currentUser) { showToast('Nejsi přihlášen.', 'error'); return; }
    openModal('myInquiriesModal');
    const list = document.getElementById('myInquiriesList');
    list.innerHTML = '<p class="inquiry-empty">Načítám...</p>';

    try {
        const snap = await getDocs(query(collection(db, 'inquiries'), where('email', '==', currentUser.email)));
        if (snap.empty) { list.innerHTML = '<p class="inquiry-empty">Zatím žádné poptávky 📭</p>'; return; }

        const svcLabel = { it: 'IT Služby', '3d': '3D Tisk', web: 'Webové stránky', other: 'Jiné' };
        const sorted   = snap.docs.sort((a, b) => {
            const ta = a.data().createdAt?.toDate?.()?.getTime() || 0;
            const tb = b.data().createdAt?.toDate?.()?.getTime() || 0;
            return tb - ta;
        });

        list.innerHTML = sorted.map(d => {
            const it  = d.data();
            const dt  = it.createdAt?.toDate?.()?.toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) || '—';
            const statusLabel = it.status === 'new'
                ? '<span style="color:#a5b4fc;font-size:0.75rem;font-weight:600">● Čeká na odpověď</span>'
                : '<span style="color:var(--success);font-size:0.75rem;font-weight:600">● Přečteno</span>';
            return `
                <div class="inquiry-item">
                    <div class="inquiry-meta">
                        ${it.service ? `<span class="inquiry-svc">${svcLabel[it.service] || it.service}</span>` : '<span></span>'}
                        <span class="inquiry-date">${dt}</span>
                    </div>
                    <p class="inquiry-msg">${escHtml(it.message)}</p>
                    <div style="margin-top:0.5rem">${statusLabel}</div>
                </div>`;
        }).join('');
    } catch (err) {
        list.innerHTML = `<p class="inquiry-empty" style="color:var(--error)">${err.message}</p>`;
    }
};

async function loadInquiryBadge() {
    if (!firebaseReady || !isAdmin) return;
    try {
        const snap = await getDocs(collection(db, 'inquiries'));
        updateInquiryBadge(snap.docs.filter(d => d.data().status === 'new').length);
    } catch {}
}

function updateInquiryBadge(n) {
    const b = document.getElementById('inquiryBadge');
    if (!b) return;
    b.textContent  = n || '';
    b.style.display = n ? 'inline' : 'none';
}

// ── Admin: Editace Služby ─────────────────────────────────────
window.editService = id => {
    const s = services.find(x => x.id === id);
    if (!s) return;
    editingSvcId = id;

    document.getElementById('edit-title').textContent = '✏️ Upravit: ' + s.title;
    document.getElementById('editModalContent').innerHTML = `
        <div class="edit-fields">
            <div class="edit-field">
                <label>Ikona (emoji)</label>
                <input id="ef-icon" type="text" value="${escAttr(s.icon)}">
            </div>
            <div class="edit-field">
                <label>Název</label>
                <input id="ef-title" type="text" value="${escAttr(s.title)}">
            </div>
            <div class="edit-field">
                <label>Krátký popis (na kartě)</label>
                <textarea id="ef-short" rows="2">${escHtml(s.shortDesc)}</textarea>
            </div>
            <div class="edit-field">
                <label>Dlouhý popis (v detailu)</label>
                <textarea id="ef-long" rows="3">${escHtml(s.longDesc)}</textarea>
            </div>
            <div class="edit-field">
                <label>Co zahrnuje</label>
                <textarea id="ef-feats" rows="5">${s.features.join('\n')}</textarea>
                <small>Každý řádek = jedna položka</small>
            </div>
            <div class="edit-field">
                <label>Cena od</label>
                <input id="ef-price" type="text" value="${escAttr(s.priceFrom)}">
            </div>
            <div class="edit-field">
                <label>Badge (napr. "Oblíbené" nebo prázdné)</label>
                <input id="ef-badge" type="text" value="${escAttr(s.badge)}">
            </div>
        </div>`;

    pendingEditFn = saveService;
    openModal('editModal');
};

async function saveService() {
    const s = services.find(x => x.id === editingSvcId);
    if (!s) return;
    s.icon      = v('ef-icon');
    s.title     = v('ef-title');
    s.shortDesc = v('ef-short');
    s.longDesc  = v('ef-long');
    s.features  = v('ef-feats').split('\n').map(l => l.trim()).filter(Boolean);
    s.priceFrom = v('ef-price');
    s.badge     = v('ef-badge');

    await setDoc(doc(db, 'siteContent', 'services'), { list: services });
    renderServices();
    closeModal('editModal');
    showToast('Karta uložena!', 'success');
}

// ── Admin: Editace Hero ───────────────────────────────────────
window.editHero = async () => {
    let data = DEFAULT_HERO;
    try {
        const snap = await getDoc(doc(db, 'siteContent', 'hero'));
        if (snap.exists()) data = snap.data();
    } catch {}

    document.getElementById('edit-title').textContent = '✏️ Upravit Hero sekci';
    document.getElementById('editModalContent').innerHTML = `
        <div class="edit-fields">
            <div class="edit-field">
                <label>Nadpis — řádek 1</label>
                <input id="ef-h1" type="text" value="${escAttr(data.line1 || '')}">
            </div>
            <div class="edit-field">
                <label>Nadpis — řádek 2 (gradient)</label>
                <input id="ef-h2" type="text" value="${escAttr(data.line2 || '')}">
            </div>
            <div class="edit-field">
                <label>Podtitulek</label>
                <textarea id="ef-hsub" rows="3">${escHtml(data.sub || '')}</textarea>
            </div>
        </div>`;

    pendingEditFn = async () => {
        const d = { line1: v('ef-h1'), line2: v('ef-h2'), sub: v('ef-hsub') };
        await setDoc(doc(db, 'siteContent', 'hero'), d);
        renderHeroData(d);
        closeModal('editModal');
        showToast('Hero uložen!', 'success');
    };
    openModal('editModal');
};

// ── Admin: Editace About ──────────────────────────────────────
window.editAbout = async () => {
    let data = DEFAULT_ABOUT;
    try {
        const snap = await getDoc(doc(db, 'siteContent', 'about'));
        if (snap.exists()) data = snap.data();
    } catch {}

    const [l1, l2] = (data.heading || '').split('\n');
    document.getElementById('edit-title').textContent = '✏️ Upravit sekci "O mně"';
    document.getElementById('editModalContent').innerHTML = `
        <div class="edit-fields">
            <div class="edit-field">
                <label>Nadpis — řádek 1</label>
                <input id="ef-a1" type="text" value="${escAttr(l1 || '')}">
            </div>
            <div class="edit-field">
                <label>Nadpis — řádek 2 (gradient)</label>
                <input id="ef-a2" type="text" value="${escAttr(l2 || '')}">
            </div>
            <div class="edit-field">
                <label>Text</label>
                <textarea id="ef-atext" rows="4">${escHtml(data.text || '')}</textarea>
            </div>
        </div>`;

    pendingEditFn = async () => {
        const d = { heading: v('ef-a1') + '\n' + v('ef-a2'), text: v('ef-atext') };
        await setDoc(doc(db, 'siteContent', 'about'), d);
        renderAboutData(d);
        closeModal('editModal');
        showToast('Sekce uložena!', 'success');
    };
    openModal('editModal');
};

// ── Uložit edit (z modal footer) ─────────────────────────────
window.saveEdit = async () => {
    if (!pendingEditFn) return;
    const btn = document.getElementById('saveEditBtn');
    btn.disabled    = true;
    btn.textContent = 'Ukládám...';
    try { await pendingEditFn(); }
    catch (err) { showToast('Chyba: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Uložit změny'; }
};

// ── Modály ────────────────────────────────────────────────────
window.openModal  = id => { const m = document.getElementById(id); m.style.display = 'flex'; document.body.style.overflow = 'hidden'; };
window.closeModal = id => {
    const m = document.getElementById(id);
    m.style.display = '';
    document.body.style.overflow = '';
    if (id === 'editModal') { pendingEditFn = null; editingSvcId = null; }
};

// ESC zavírá modal
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    for (const id of ['serviceModal', 'editModal', 'inquiriesModal']) {
        const m = document.getElementById(id);
        if (m && m.style.display === 'flex') { closeModal(id); break; }
    }
});

// ── Navigace ──────────────────────────────────────────────────
window.scrollToSection = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// ── Toast ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ── Utils ─────────────────────────────────────────────────────
const v       = id => document.getElementById(id)?.value ?? '';
const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escAttr = s => String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// ── Start ─────────────────────────────────────────────────────
loadContent();
