/**
 * Planner
 * 
 * Converts a high-level user goal into a structured JSON execution plan.
 * 
 * Supports two providers:
 *   - "hardcoded"  — uses built-in plan templates (default, always available)
 *   - "llm"        — sends the goal to Groq and receives a dynamic plan
 * 
 * The LLM provider automatically falls back to hardcoded if the Groq call
 * fails, ensuring the system never crashes due to an LLM error.
 * 
 * Plan schema:
 * {
 *   "goal":  string,            // The original user intent
 *   "steps": [
 *     {
 *       "tool":   string,       // Tool name (must exist in tool_registry)
 *       "params": object,       // Parameters to pass to the tool handler
 *       "meta":   object        // Optional metadata (reasoning, retries, etc.)
 *     }
 *   ]
 * }
 */

const logger = require('../utils/logger');
const { listTools } = require('./tool_registry');
const { generatePlanFromGroq } = require('../llm/groq');

// ─── Hardcoded Plan Templates ────────────────────────────────────────────────
// Each key is a recognizable goal intent; the value is a factory that returns
// a plan object.  A future LLM planner would replace this map entirely.

const PLAN_TEMPLATES = {
    /**
     * Default demo plan — navigates to a page, scrolls, detects and fills a
     * form, then takes a screenshot.
     */
    default: (params = {}) => ({
        goal: params.goal || 'Navigate to a page, fill a form, and take a screenshot.',
        steps: [
            {
                tool: 'open_browser',
                params: {},
                meta: { description: 'Launch the browser' }
            },
            {
                tool: 'navigate_to_url',
                params: { url: params.url || 'https://ui.shadcn.com/docs/forms/react-hook-form' },
                meta: { description: 'Navigate to target URL' }
            },
            {
                tool: 'scroll',
                params: { direction: 'down', distance: params.scrollDistance || 600 },
                meta: { description: 'Scroll to form section', delayBefore: 2000 }
            },
            {
                tool: 'detect_form',
                params: {},
                meta: { description: 'Detect form fields on the page' }
            },
            {
                tool: 'fill_form',
                params: {
                    name: params.name || 'Ayush Kumar Patra',
                    description: params.description || 'This form was completed by the Website Automation Agent.'
                },
                meta: { description: 'Fill the form with provided data', requiresResult: 'detect_form' }
            },
            {
                tool: 'take_screenshot',
                params: { filename: params.screenshotName || 'shadcn_form_filled.png' },
                meta: { description: 'Capture the final state', delayBefore: 1000 }
            }
        ]
    })
};

// ─── Planner API ─────────────────────────────────────────────────────────────

/**
 * Generate an execution plan for the given goal.
 * 
 * @param {string} goal          - Natural-language description of what the user wants.
 * @param {object} params        - Additional parameters to customise the plan.
 * @param {object} [options]     - Planner options.
 * @param {string} [options.provider]   - 'hardcoded' | 'llm'
 * @param {string} [options.model]      - Groq model name (only used when provider='llm')
 * @returns {Promise<object>}    - The execution plan.
 */
async function generatePlan(goal, params = {}, options = {}) {
    const provider = options.provider || 'hardcoded';

    logger.info(`[Planner] Generating plan for goal: "${goal}" (provider: ${provider})`);

    // ── LLM Provider (Groq) ──
    if (provider === 'llm') {
        try {
            const availableTools = listTools();
            logger.info(`[Planner] Available tools: ${availableTools.map(t => t.name).join(', ')}`);

            // Send goal + tools to Groq and get a plan back
            const plan = await generatePlanFromGroq(goal, availableTools, {
                model: options.model
            });

            // Validate the plan structure and tool references
            logger.info('[Planner] Validating plan...');
            validatePlan(plan);
            logger.info('[Planner] Plan validation successful.');

            logger.info(`[Planner] Plan generated with ${plan.steps.length} steps.`);
            logger.debug(`[Planner] Plan: ${JSON.stringify(plan, null, 2)}`);

            return plan;
        } catch (error) {
            // ── Graceful fallback ──
            // Never crash because of an LLM error.
            logger.warn(`[Planner] LLM planning failed: ${error.message}`);
            logger.warn('[Planner] Falling back to hardcoded planner.');

            return generateHardcodedPlan(goal, params);
        }
    }

    // ── Hardcoded Provider ──
    return generateHardcodedPlan(goal, params);
}

/**
 * Generate a plan from the hardcoded templates.
 */
function generateHardcodedPlan(goal, params = {}) {
    const templateKey = selectTemplate(goal);
    const planFactory = PLAN_TEMPLATES[templateKey];
    const plan = planFactory({ goal, ...params });

    logger.info(`[Planner] Plan generated with ${plan.steps.length} steps (hardcoded).`);
    logger.debug(`[Planner] Plan: ${JSON.stringify(plan, null, 2)}`);

    return plan;
}

/**
 * Simple keyword-based template selector.
 * In the future, this is replaced by the LLM altogether.
 */
function selectTemplate(goal) {
    // For now, everything maps to 'default'.
    // Extend with more templates as needed.
    return 'default';
}

/**
 * Validate that a plan meets the required schema:
 *   1. JSON parsed correctly (already done by caller)
 *   2. Every step.tool exists in the Tool Registry
 *   3. Every step has: tool (string), params (object), meta.description (string)
 * 
 * @param {object} plan
 * @returns {object} The same plan if valid.
 * @throws {Error} If any validation check fails.
 */
function validatePlan(plan) {
    if (!plan || typeof plan !== 'object') {
        throw new Error('Plan is not a valid object.');
    }
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
        throw new Error('Plan must contain a non-empty "steps" array.');
    }

    const knownTools = new Set(listTools().map(t => t.name));

    for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const label = `Step ${i + 1}`;

        // tool must be a string
        if (!step.tool || typeof step.tool !== 'string') {
            throw new Error(`${label}: "tool" must be a non-empty string.`);
        }

        // tool must exist in registry
        if (!knownTools.has(step.tool)) {
            throw new Error(`${label}: Unknown tool "${step.tool}". Available: ${[...knownTools].join(', ')}`);
        }

        // params must be an object
        if (!step.params || typeof step.params !== 'object') {
            throw new Error(`${label}: "params" must be an object.`);
        }

        // meta.description must exist
        if (!step.meta || typeof step.meta !== 'object' || !step.meta.description) {
            throw new Error(`${label}: "meta.description" is required.`);
        }
    }

    return plan;
}

module.exports = { generatePlan, validatePlan };
