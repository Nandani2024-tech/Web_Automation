/**
 * Groq LLM Client
 * 
 * Wraps the Groq SDK to generate JSON execution plans from natural-language
 * goals.  This module is the only place that touches the Groq API — the rest
 * of the agent stack (executor, tool registry) remains unchanged.
 * 
 * Responsibilities:
 *   1. Initialise the Groq SDK with GROQ_API_KEY from .env
 *   2. Build a system prompt that includes the available tool list
 *   3. Send the user goal to the LLM and request a JSON plan
 *   4. Parse and return the plan object
 */

const Groq = require('groq-sdk');
const logger = require('../utils/logger');

// ─── SDK Initialisation ──────────────────────────────────────────────────────

let groqClient = null;

/**
 * Lazily initialise the Groq client.
 * Called on the first plan request so startup stays fast.
 */
function getClient() {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY is not set. Add it to your .env file.');
        }
        groqClient = new Groq({ apiKey });
    }
    return groqClient;
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

/**
 * Build the system prompt for the planning LLM.
 * Injects the currently registered tools so the model knows what it can use.
 * 
 * @param {Array<{name: string, description: string}>} tools
 * @returns {string}
 */
function buildSystemPrompt(tools) {
    const toolList = tools
        .map(t => `  - ${t.name}: ${t.description}`)
        .join('\n');

    return `You are a browser automation planning agent.

Your task is NOT to execute actions.
Your task is ONLY to create a valid JSON execution plan.

Available tools:
${toolList}

Rules:
1. Use ONLY the tools listed above.
2. Return valid JSON only — no markdown fences, no explanations, no extra text.
3. Every step must contain:
   - "tool"  (string — one of the tool names above)
   - "params" (object — arguments the tool needs, e.g. { "url": "..." })
   - "meta"  (object with at least a "description" string)
4. For the "scroll" tool, params should include "direction" ("up" or "down") and "distance" (pixels).
5. For "navigate_to_url", params must include "url".
6. For "take_screenshot", params should include "filename".
7. For "fill_form", params should include "name" and "description" strings. Do NOT include "locators" — those are injected at runtime.
8. Add "meta.delayBefore" (milliseconds) when a step needs the page to settle (e.g. after navigation or before screenshot).
9. Add "meta.requiresResult" set to the tool name of a prior step when the current step needs data from it (e.g. fill_form requires detect_form).
10. Always start with "open_browser" and do NOT include "close_browser" — the framework handles cleanup.

Output schema:
{
  "goal": "string describing what the plan achieves",
  "steps": [
    {
      "tool": "tool_name",
      "params": {},
      "meta": {
        "description": "what this step does"
      }
    }
  ]
}`;
}

// ─── Plan Generation ─────────────────────────────────────────────────────────

/**
 * Generate a JSON execution plan via Groq.
 * 
 * @param {string} goal            - Natural-language user goal.
 * @param {Array}  availableTools  - Output of listTools() from the registry.
 * @param {object} [options]       - Optional overrides.
 * @param {string} [options.model] - Groq model to use (defaults to env var).
 * @returns {Promise<object>}      - The parsed plan object.
 */
async function generatePlanFromGroq(goal, availableTools, options = {}) {
    const client = getClient();
    const model = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const systemPrompt = buildSystemPrompt(availableTools);

    logger.info('[Planner] Requesting plan from Groq...');
    logger.debug(`[Planner] Model: ${model}`);
    logger.debug(`[Planner] Goal: "${goal}"`);

    const chatCompletion = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: goal }
        ],
        temperature: 0.2,         // Low temperature for deterministic structured output
        max_tokens: 2048,
        response_format: { type: 'json_object' }   // Force JSON mode
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;

    if (!rawResponse) {
        throw new Error('Groq returned an empty response.');
    }

    logger.info('[Planner] Received response from Groq.');
    logger.debug(`[Planner] Raw response: ${rawResponse}`);

    // Parse the JSON
    const plan = parseJsonResponse(rawResponse);

    return plan;
}

// ─── JSON Parsing ────────────────────────────────────────────────────────────

/**
 * Safely parse the LLM response into a JSON object.
 * Handles edge cases like markdown code fences that models sometimes emit.
 * 
 * @param {string} raw - The raw string from the LLM.
 * @returns {object}   - Parsed JSON object.
 */
function parseJsonResponse(raw) {
    let cleaned = raw.trim();

    // Strip markdown code fences if present (```json ... ```)
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    try {
        return JSON.parse(cleaned);
    } catch (error) {
        throw new Error(`Failed to parse Groq response as JSON: ${error.message}\nRaw: ${cleaned}`);
    }
}

module.exports = { generatePlanFromGroq };
