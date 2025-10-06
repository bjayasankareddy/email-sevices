// --- State & Config ---
let currentUserEmail = null;
const QMAIL_DOMAIN = "qmail.co.in"; // Your app's domain

// --- Quantum-Safe Cryptography Placeholder ---
const mockOQS = {
    KeyEncapsulation: async (algorithm, username) => {
        const publicKey = `-----BEGIN MOCK PUBLIC KEY-----\n${btoa(Math.random().toString())}\n-----END MOCK PUBLIC KEY-----`;
        const privateKey = `-----BEGIN MOCK PRIVATE KEY-----\n${btoa(Math.random().toString())}\n-----END MOCK PRIVATE KEY-----`;
        localStorage.setItem(`qmail_private_key_${username}@${QMAIL_DOMAIN}`, privateKey);
        return { publicKey, privateKey };
    },
    encapsulateSecret: async (publicKey, message) => {
        const encryptedMessage = `[ENCRYPTED-WITH-${publicKey.substring(28,38)}]${btoa(message)}`;
        return encryptedMessage;
    },
    decapsulateSecret: async (privateKey, encryptedMessage) => {
        try {
            const base64Message = encryptedMessage.substring(encryptedMessage.indexOf(']') + 1);
            return atob(base64Message);
        } catch (e) {
            return "[DECRYPTION FAILED - DATA CORRUPT]";
        }
    }
};

// --- DOM Element References ---
const authContainer = document.getElementById('auth-container');
const appLayout = document.getElementById('app-layout');
const registrationView = document.getElementById('registration-view');
const loginView = document.getElementById('login-view');
const composeView = document.getElementById('compose-view');
const emailView = document.getElementById('email-view');
const registrationForm = document.getElementById('registration-form');
const loginForm = document.getElementById('login-form');
const composeForm = document.getElementById('compose-form');
const logoutButton = document.getElementById('logout-button');
const composeNewBtn = document.getElementById('compose-new-btn');
const showLoginLink = document.getElementById('show-login');
const showRegisterLink = document.getElementById('show-register');
const messageDisplay = document.getElementById('message-display');
const welcomeMessage = document.getElementById('welcome-message');
const closeModalBtns = document.querySelectorAll('.close-modal-btn');
const navItems = document.querySelectorAll('.nav-item');
const loginEmailInput = document.querySelector('#login-view input[type="text"]'); // Corrected selector

// Email view DOM
const inboxListView = document.getElementById('inbox-view');
const sentListView = document.getElementById('sent-view');
const draftsListView = document.getElementById('drafts-view');
const inboxList = document.getElementById('inbox-list');
const sentList = document.getElementById('sent-list');
const refreshInboxButton = document.getElementById('refresh-inbox-button');
const refreshSentButton = document.getElementById('refresh-sent-button');


// --- Event Listeners ---
registrationForm.addEventListener('submit', handleRegistration);
loginForm.addEventListener('submit', handleLogin);
composeForm.addEventListener('submit', handleCompose);
logoutButton.addEventListener('click', handleLogout);
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); switchToLoginView(); });
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchToRegisterView(); });
composeNewBtn.addEventListener('click', () => composeView.classList.remove('hidden'));
closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
    composeView.classList.add('hidden');
    emailView.classList.add('hidden');
}));
refreshInboxButton.addEventListener('click', fetchInbox);
refreshSentButton.addEventListener('click', fetchSent);
navItems.forEach(item => item.addEventListener('click', handleNavClick));


// --- Handler Functions ---
async function handleRegistration(event) {
    event.preventDefault();
    const formData = new FormData(registrationForm);
    const registrationData = Object.fromEntries(formData.entries());
    showMessage('Creating account...', 'info');

    try {
        const kem = await mockOQS.KeyEncapsulation("Kyber768", registrationData.username);
        registrationData.public_key = kem.publicKey;

        const response = await fetch('http://127.0.0.1:8000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Registration failed');
        showMessage(`Success! Account for '${result.email}' created. Please login.`, 'success');
        registrationForm.reset();
        switchToLoginView();
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');
    showMessage('Logging in...', 'info');

    try {
        const response = await fetch('http://127.0.0.1:8000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Login failed');
        currentUserEmail = result.email;
        loginForm.reset();
        showDashboard(currentUserEmail);
        switchToView('inbox');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function handleCompose(event) {
    event.preventDefault();
    const recipientEmail = document.getElementById('recipient-email').value;
    const messageBody = document.getElementById('message-body').value;
    if (!recipientEmail || !messageBody) return;
    
    showMessage('Sending...', 'info');
    try {
        const keyResponse = await fetch(`http://127.0.0.1:8000/users/${recipientEmail}/key`);
        if (!keyResponse.ok) throw new Error('Could not find recipient public key.');
        const keyResult = await keyResponse.json();
        const encryptedBody = await mockOQS.encapsulateSecret(keyResult.public_key, messageBody);
        const emailData = { sender_email: currentUserEmail, recipient_email: recipientEmail, encrypted_body: encryptedBody };
        const sendResponse = await fetch('http://127.0.0.1:8000/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData)
        });
        if (!sendResponse.ok) throw new Error('Failed to send email.');
        showMessage('Email sent successfully!', 'success');
        composeForm.reset();
        composeView.classList.add('hidden');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

function handleLogout() {
    currentUserEmail = null;
    switchToAuthView();
}

// --- Email Data Fetching & Rendering ---
async function fetchInbox() {
    if (!currentUserEmail) return;
    inboxList.innerHTML = '<li>Loading...</li>';
    try {
        const response = await fetch(`http://127.0.0.1:8000/inbox/${currentUserEmail}`);
        if (!response.ok) throw new Error('Could not fetch inbox.');
        const emails = await response.json();
        renderEmailList(emails, inboxList, 'inbox');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function fetchSent() {
    if (!currentUserEmail) return;
    sentList.innerHTML = '<li>Loading...</li>';
    try {
        const response = await fetch(`http://127.0.0.1:8000/sent/${currentUserEmail}`);
        if (!response.ok) throw new Error('Could not fetch sent mail.');
        const emails = await response.json();
        renderEmailList(emails, sentList, 'sent');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

function renderEmailList(emails, listElement, type) {
    listElement.innerHTML = '';
    if (emails.length === 0) {
        listElement.innerHTML = `<li class="empty-inbox">This folder is empty.</li>`;
        return;
    }
    emails.forEach(email => {
        const li = document.createElement('li');
        li.className = 'email-item';
        const partner = type === 'inbox' ? email.sender_email : email.recipient_email;
        const partnerLabel = type === 'inbox' ? 'From' : 'To';
        
        li.innerHTML = `
            <strong>${partnerLabel}: ${partner}</strong>
            <span class="email-subject">Encrypted Message</span>
            <span class="email-timestamp">${new Date(email.timestamp).toLocaleString()}</span>
        `;
        li.dataset.encryptedBody = email.encrypted_body;
        li.dataset.sender = email.sender_email;
        li.dataset.recipient = email.recipient_email;
        li.dataset.timestamp = new Date(email.timestamp).toLocaleString();
        li.addEventListener('click', () => viewEmail(li, type));
        listElement.appendChild(li);
    });
}

async function viewEmail(emailElement, type) {
    const encryptedBody = emailElement.dataset.encryptedBody;
    const privateKey = localStorage.getItem(`qmail_private_key_${currentUserEmail}`);
    if (!privateKey) {
        showMessage('Your private key is missing! Cannot decrypt.', 'error');
        return;
    }
    
    const canDecrypt = (type === 'inbox');
    const decryptedBody = canDecrypt 
        ? await mockOQS.decapsulateSecret(privateKey, encryptedBody)
        : "[Cannot decrypt sent mail from this client]";

    document.getElementById('email-from').textContent = emailElement.dataset.sender;
    document.getElementById('email-to').textContent = emailElement.dataset.recipient;
    document.getElementById('email-timestamp').textContent = emailElement.dataset.timestamp;
    document.getElementById('email-decrypted-body').textContent = decryptedBody;
    emailView.classList.remove('hidden');
}

// --- View Switching Logic ---
function handleNavClick(e) {
    const view = e.currentTarget.id.replace('nav-', '');
    switchToView(view);
}

function switchToView(view) {
    [inboxListView, sentListView, draftsListView].forEach(v => v.classList.add('hidden'));
    navItems.forEach(item => item.classList.remove('active'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
    document.getElementById(`nav-${view}`).classList.add('active');
    
    if (view === 'inbox') fetchInbox();
    if (view === 'sent') fetchSent();
}

function switchToLoginView() {
    loginView.classList.remove('hidden');
    registrationView.classList.add('hidden');
    // Update login form to expect an email address
    if(loginEmailInput) {
       loginEmailInput.placeholder = `user@${QMAIL_DOMAIN}`;
       loginEmailInput.name = 'email';
    }
}

function switchToRegisterView() {
    registrationView.classList.remove('hidden');
    loginView.classList.add('hidden');
}

function showDashboard(email) {
    appLayout.classList.remove('hidden');
    authContainer.classList.add('hidden');
    welcomeMessage.textContent = email;
}

function switchToAuthView() {
    authContainer.classList.remove('hidden');
    appLayout.classList.add('hidden');
    switchToLoginView();
}

let messageTimeout;
function showMessage(message, type) {
    messageDisplay.textContent = message;
    messageDisplay.className = 'message-display';
    clearTimeout(messageTimeout);
    if (message && type) {
        messageDisplay.classList.add(type);
        messageDisplay.classList.add('visible');
        messageTimeout = setTimeout(() => {
            messageDisplay.classList.remove('visible');
        }, 4000);
    }
}

// --- Initial state ---
switchToRegisterView();
// Update login placeholder on initial load
if(loginEmailInput) {
    loginEmailInput.placeholder = `user@${QMAIL_DOMAIN}`;
    loginEmailInput.name = 'email';
}

