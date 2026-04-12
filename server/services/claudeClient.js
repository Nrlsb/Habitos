const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[AI] ANTHROPIC_API_KEY not configured — AI endpoints will return 503');
}

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = 'claude-3-5-haiku-20241022';

// In-memory cache: Map<cacheKey, { result, timestamp }>
const responseCache = new Map();

const getCached = (key, ttlMs) => {
    const entry = responseCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > ttlMs) {
        responseCache.delete(key);
        return null;
    }

    return entry.result;
};

const setCache = (key, result) => {
    responseCache.set(key, { result, timestamp: Date.now() });

    // Cleanup if cache grows too large
    if (responseCache.size > 500) {
        const oldestKey = responseCache.keys().next().value;
        responseCache.delete(oldestKey);
    }
};

// Simple call with cached system prompt
const callClaude = async ({ systemPrompt, userMessage, maxTokens = 500 }) => {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: [{
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" }
        }],
        messages: [{
            role: "user",
            content: userMessage
        }]
    });

    return response.content[0].text;
};

// Call with message history (for chat)
const callClaudeWithHistory = async ({ systemPrompt, messages, maxTokens = 400 }) => {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: [{
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" }
        }],
        messages: messages.map(m => ({
            role: m.role,
            content: m.content
        }))
    });

    return response.content[0].text;
};

module.exports = {
    callClaude,
    callClaudeWithHistory,
    getCached,
    setCache
};
