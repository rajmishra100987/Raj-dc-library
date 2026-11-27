global.WebSocket = require('ws'); // Railway & Node WebSocket fix

const express = require('express');
const { Client } = require('meta-messenger.js');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Anti-Crash System
process.on('uncaughtException', (err) => console.error('[ANTI-CRASH] Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('[ANTI-CRASH] Unhandled Rejection:', reason));

// Keep-Alive Routes
app.head('/', (req, res) => res.status(200).end());
app.get('/', (req, res) => res.send('raj mishra meta-messenger server running ✅️'));
app.get('/ping', (req, res) => res.status(200).send('Pong - Server is Active!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM LIVE] Server listening on port ${PORT}`);
    startMultiBots();
});

// Helper to read configuration text files
function readTextFile(filename, defaultValue = '') {
    try {
        if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8').trim();
        }
    } catch (e) {
        console.error(`Error reading ${filename}:`, e.message);
    }
    return defaultValue;
}

// Meta-Messenger.js ke liye Cookies string ko Object me convert karna
function parseRawCookies(cookieString) {
    const cookies = {};
    if (!cookieString || !cookieString.trim()) return cookies;
    cookieString.split(';').forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            cookies[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
    });
    return cookies;
}

async function startMultiBots() {
    console.log('[SYSTEM] Initializing Meta-Messenger Bot Engine (No Skipping)...');
    
    // Padho saari cookies (tokens)
    const cookiesRaw = readTextFile('cookies.txt');
    const cookiesList = cookiesRaw.split('\n').map(c => c.trim()).filter(Boolean);

    if (cookiesList.length === 0) {
        console.log('[CONFIG ERROR] cookies.txt is empty. Retrying in 10s...');
        setTimeout(startMultiBots, 10000);
        return;
    }

    // Clients ka pool banayenge. Agar koi connect nahi ho paya, toh bhi isko list me rakhenge
    let clientsPool = [];
    
    for (let i = 0; i < cookiesList.length; i++) {
        clientsPool.push({
            id: i + 1,
            cookieStr: cookiesList[i],
            client: null, // Abhi connect nahi hai
            isDead: false
        });
    }

    let msgIndex = 0;
    let loopCount = 1;

    // MAIN INFINITE LOOP
    while (true) {
        const threadId = readTextFile('convo.txt');
        const currentDelaySec = parseInt(readTextFile('time.txt', '120'), 10) || 120;
        const hatersName = readTextFile('hatersname.txt');
        const currentMsgsRaw = readTextFile('messages.txt', 'Hello');
        const currentMsgs = currentMsgsRaw.split('\n').map(m => m.trim()).filter(Boolean);

        if (!threadId || currentMsgs.length === 0) {
            console.log('[WAITING] Waiting for convo.txt or messages.txt...');
            await new Promise(r => setTimeout(r, 10000));
            continue;
        }

        // Message index ko token ke hisaab se modulo karo
        const tokenIndex = msgIndex % clientsPool.length;
        const currentBot = clientsPool[tokenIndex];
        
        if (msgIndex >= currentMsgs.length) {
            msgIndex = 0;
            loopCount++;
            console.log(`[LOOP] 🔄 Completed full list. Restarting (Round ${loopCount})...`);
        }

        const rawMsg = currentMsgs[msgIndex] || "Hello";
        const finalMessage = hatersName ? `${hatersName} ${rawMsg}` : rawMsg;

        // 1. CHECK CONNECTION (Agar pehle se connected nahi hai, toh connect karo)
        if (!currentBot.client || !currentBot.client.isConnected) {
            console.log(`[ACC-${currentBot.id}] 🔄 Connecting/Reconnecting...`);
            try {
                const cookiesObj = parseRawCookies(currentBot.cookieStr);
                if (!cookiesObj.c_user || !cookiesObj.xs) {
                    throw new Error('c_user ya xs cookie missing hai');
                }

                currentBot.client = new Client(cookiesObj, {
                    platform: 'messenger',
                    enableE2EE: false,
                    autoReconnect: false,
                    logLevel: 'none'
                });
                
                await currentBot.client.connect();
                console.log(`[ACC-${currentBot.id}] ✅ Login Successful!`);
            } catch (connErr) {
                console.error(`[ACC-${currentBot.id}] ❌ Connection Failed: ${connErr.message}`);
                currentBot.client = null; // Reset client taaki next round me wapas try kare
            }
        }

        // 2. SEND MESSAGE
        if (currentBot.client && currentBot.client.isConnected) {
            try {
                // meta-messenger.js me threadId BigInt format me chahiye hota hai
                const threadIdBigInt = BigInt(threadId);
                
                await currentBot.client.sendMessage(threadIdBigInt, finalMessage);
                console.log(`[${new Date().toLocaleTimeString()}] [ACC-${currentBot.id}] 🚀 Sent: ${finalMessage.substring(0, 30)}...`);
            } catch (sendErr) {
                console.error(`[${new Date().toLocaleTimeString()}] [ACC-${currentBot.id}] ⚠️ Send Failed: ${sendErr.message}`);
                // Agar message send fail hua, toh client ko null kar do taaki agli baar dobara connect ho
                try { await currentBot.client.disconnect(); } catch (e) {}
                currentBot.client = null; 
            }
        } else {
            console.log(`[${new Date().toLocaleTimeString()}] [ACC-${currentBot.id}] ⏭️ Skipped sending due to connection issue. Will retry next round.`);
        }

        // Next message aur next token ke liye index badhao
        msgIndex++;

        // Delay ke baad next account chalega
        await new Promise(resolve => setTimeout(resolve, currentDelaySec * 1000));
    }
}
