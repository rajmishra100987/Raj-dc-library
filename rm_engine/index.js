// ============================================================
// Raj Mishra Local Transport Engine
// ============================================================
const WebSocket = require('ws');
global.WebSocket = WebSocket;

function getTransportClass() {
    const modId = ['meta', 'messenger.js'].join('-');
    try {
        const mod = require(modId);
        return mod.Client || mod.default?.Client || null;
    } catch (_) {
        return null;
    }
}

const TransportClass = getTransportClass();

class RajMishraEngineClient {
    constructor(cookies, options = {}) {
        this.cookies = cookies || {};
        this.options = {
            platform: options.platform || 'messenger',
            enableE2EE: options.enableE2EE ?? false,
            autoReconnect: options.autoReconnect ?? false,
            logLevel: options.logLevel || 'none'
        };
        this.client = null;
    }

    async connect() {
        if (!TransportClass) {
            throw new Error('Transport engine available nahi hai');
        }
        this.client = new TransportClass(this.cookies, this.options);
        if (typeof this.client.loadMessagesPage === 'function') {
            await this.client.loadMessagesPage();
        }
        return this.client.connect();
    }

    async sendMessage(threadId, text) {
        if (!this.client) {
            throw new Error('Session connected nahi hai');
        }
        return this.client.sendMessage(threadId, text);
    }

    close() {
        if (!this.client) return;
        try {
            if (typeof this.client.close === 'function') this.client.close();
            else if (typeof this.client.disconnect === 'function') this.client.disconnect();
        } catch (_) {}
        this.client = null;
    }
}

module.exports = {
    RajMishraEngineClient,
    Client: RajMishraEngineClient
};
