// ============================================================
// Raj Mishra Messenger Wrapper
// ============================================================
const fs = require('fs');
const path = require('path');

function loadRajMishraEngine() {
    const candidates = [
        path.join(__dirname, 'rm_engine', 'index.js'),
        path.join(__dirname, 'rm_engine.js'),
        path.join(__dirname, 'engine', 'index.js')
    ];

    for (const fullPath of candidates) {
        if (!fs.existsSync(fullPath)) continue;
        const mod = require(fullPath);
        const ClientClass =
            mod.RajMishraEngineClient ||
            mod.Client ||
            mod.default?.Client ||
            mod.default;

        if (typeof ClientClass === 'function') {
            return ClientClass;
        }
    }

    return null;
}

const RajMishraEngine = loadRajMishraEngine();

function parseRajMishraCookies(cookieInput) {
    if (cookieInput && typeof cookieInput === 'object') {
        return cookieInput;
    }
    const cookies = {};
    for (const part of String(cookieInput || '').split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key) cookies[key] = value;
    }
    return cookies;
}

class RajMishraClient {
    constructor(cookies, options = {}) {
        if (!RajMishraEngine) {
            throw new Error('[RajMishra] Engine load nahi ho paaya');
        }
        const parsed = parseRajMishraCookies(cookies);
        if (!parsed.c_user || !parsed.xs) {
            throw new Error('[RajMishra] c_user ya xs cookie missing hai');
        }

        this.session = new RajMishraEngine(parsed, {
            platform: options.platform || 'messenger',
            enableE2EE: options.enableE2EE ?? false,
            autoReconnect: options.autoReconnect ?? false,
            logLevel: options.logLevel || 'none'
        });
    }

    async connect() {
        return this.session.connect();
    }

    async sendMessage(threadId, text) {
        const targetId = typeof threadId === 'bigint' ? threadId : BigInt(String(threadId).trim());
        return this.session.sendMessage(targetId, text);
    }

    close() {
        if (!this.session) return;
        try {
            if (typeof this.session.close === 'function') this.session.close();
            else if (typeof this.session.disconnect === 'function') this.session.disconnect();
        } catch (_) {}
    }
}

module.exports = {
    RajMishraClient,
    Client: RajMishraClient,
    parseRajMishraCookies
};
