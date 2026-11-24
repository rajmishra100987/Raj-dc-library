// ============================================================
// Raj Mishra Multi-Token Bot Server
// ============================================================
const express = require('express');
const fs = require('fs');
const { RajMishraClient } = require('./rajmishra.js');

const app = express();
const PORT = process.env.PORT || 3000;

const MIN_DELAY_SEC = 15;
const JITTER_MIN_MS = 2000;
const JITTER_MAX_MS = 6000;
const MAX_CONSECUTIVE_SEND_FAILS = 5;
const SEND_COOLDOWN_MS = 10 * 60 * 1000;

// Anti-Crash System
process.on('uncaughtException', (err) => console.error('[ANTI-CRASH] Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('[ANTI-CRASH] Unhandled Rejection:', reason));

// Keep-Alive Routes
app.head('/', (_req, res) => res.status(200).end());
app.get('/', (_req, res) => res.send('raj mishra multi-token server running ✅️'));
app.get('/ping', (_req, res) => res.status(200).send('Pong - Server is Active!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM LIVE] Raj Mishra server listening on port ${PORT}`);
    startRajMishraLoop();
});

function readTextFile(filename, defaultValue = '') {
    try {
        if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8').trim();
        }
    } catch (e) {
        console.error(`[FILE ERROR] ${filename}:`, e.message);
    }
    return defaultValue;
}

function getSafeDelayMs(delaySec) {
    const baseSec = Math.max(MIN_DELAY_SEC, parseInt(delaySec, 10) || MIN_DELAY_SEC);
    const jitterMs = Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1)) + JITTER_MIN_MS;
    return baseSec * 1000 + jitterMs;
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

class RajMishraSlot {
    constructor(id, cookieStr) {
        this.id = id;
        this.cookieStr = cookieStr;
        this.bot = null;
        this.failStreak = 0;
    }

    async ensureConnected() {
        if (this.bot) return true;

        const client = new RajMishraClient(this.cookieStr, {
            platform: 'messenger',
            enableE2EE: false,
            autoReconnect: false,
            logLevel: 'none'
        });

        await withTimeout(client.connect(), 40000, 'connect');
        this.bot = client;
        return true;
    }

    async send(threadId, text) {
        await this.ensureConnected();
        return withTimeout(
            this.bot.sendMessage(threadId, text),
            20000,
            'sendMessage'
        );
    }

    reset() {
        const current = this.bot;
        this.bot = null;
        if (current && typeof current.close === 'function') {
            try {
                current.close();
            } catch (_) {}
        }
    }
}

async function startRajMishraLoop() {
    console.log('[RAJ MISHRA] Initializing multi-token loop...');

    const cookiesRaw = readTextFile('cookies.txt');
    const cookiesList = cookiesRaw.split('\n').map((c) => c.trim()).filter(Boolean);

    if (cookiesList.length === 0) {
        console.log('[CONFIG ERROR] cookies.txt is empty. Retrying in 10s...');
        setTimeout(startRajMishraLoop, 10000);
        return;
    }

    const slots = cookiesList.map((cookieStr, idx) => new RajMishraSlot(idx + 1, cookieStr));

    let msgIndex = 0;
    let loopCount = 1;

    while (true) {
        const threadId = readTextFile('convo.txt');
        const delaySec = parseInt(readTextFile('time.txt', '120'), 10) || 120;
        const hatersName = readTextFile('hatersname.txt');
        const msgsRaw = readTextFile('messages.txt', 'Hello');
        const msgs = msgsRaw.split('\n').map((m) => m.trim()).filter(Boolean);

        if (!/^\d+$/.test(threadId) || msgs.length === 0) {
            console.log('[WAITING] Waiting for valid numeric convo.txt or messages.txt...');
            await new Promise((r) => setTimeout(r, 10000));
            continue;
        }

        if (msgIndex >= msgs.length) {
            msgIndex = 0;
            loopCount++;
            console.log(`[LOOP] 🔄 Completed full list. Restarting (Round ${loopCount})...`);
        }

        const currentSlot = slots[msgIndex % slots.length];
        const rawMsg = msgs[msgIndex] || 'Hello';
        const finalMessage = hatersName ? `${hatersName} ${rawMsg}` : rawMsg;

        try {
            if (!currentSlot.bot) {
                console.log(`[RM-SLOT-${currentSlot.id}] 🔄 Connecting...`);
                await currentSlot.ensureConnected();
                console.log(`[RM-SLOT-${currentSlot.id}] ✅ Connected!`);
            }

            await currentSlot.send(threadId, finalMessage);
            currentSlot.failStreak = 0;
            console.log(`[${new Date().toLocaleTimeString()}] [RM-SLOT-${currentSlot.id}] 🚀 Sent: ${finalMessage.slice(0, 30)}...`);
        } catch (err) {
            currentSlot.failStreak++;
            console.error(`[${new Date().toLocaleTimeString()}] [RM-SLOT-${currentSlot.id}] ⚠️ Error: ${err.message}`);
            currentSlot.reset();

            if (currentSlot.failStreak >= MAX_CONSECUTIVE_SEND_FAILS) {
                currentSlot.failStreak = 0;
                console.log(`[RM-SLOT-${currentSlot.id}] ⏸️ Cooling down for 10 minutes...`);
                await new Promise((r) => setTimeout(r, SEND_COOLDOWN_MS));
            }
        }

        msgIndex++;
        const waitMs = getSafeDelayMs(delaySec);
        await new Promise((r) => setTimeout(r, waitMs));
    }
}
