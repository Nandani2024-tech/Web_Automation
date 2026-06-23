/**
 * Website Automation Agent — Entry Point
 * 
 * Execution flow:
 *   1. Load environment variables (.env)
 *   2. Planner generates a plan via Groq LLM (falls back to hardcoded)
 *   3. Executor runs each step through the tool registry
 *   4. Browser is closed in the finally block regardless of outcome
 * 
 * Usage:
 *   node index.js
 */

// Load .env before anything else
require('dotenv').config();

const { generatePlan, executePlan } = require('./src/agent');
const { close_browser } = require('./src/tools/browser_tools');
const logger = require('./src/utils/logger');

async function main() {
    try {
        logger.info('═══════════════════════════════════════════════════');
        logger.info(' Website Automation Agent');
        logger.info('═══════════════════════════════════════════════════');

        // ── Step 1: Define the goal ──
        const goal = 'Navigate to https://ui.shadcn.com/docs/forms/react-hook-form, scroll down to find the form, fill it with a name and description, and take a screenshot.';

        // ── Step 2: Generate the plan via LLM ──
        const plan = await generatePlan(goal, {}, {
            provider: 'llm'
        });

        // Print the generated plan before execution
        logger.info('──────────── Generated Plan ────────────');
        console.log(JSON.stringify(plan, null, 2));
        logger.info('────────────────────────────────────────');

        // ── Step 3: Execute the plan ──
        const report = await executePlan(plan);

        // ── Step 4: Log the result ──
        if (report.status === 'success') {
            logger.info('Agent completed all steps successfully. Check the screenshots folder.');
        } else {
            logger.warn('Agent finished with errors. Review the logs above.');
        }
    } catch (error) {
        logger.error('Fatal error:', error.message);
    } finally {
        await close_browser();
    }
}

main();
