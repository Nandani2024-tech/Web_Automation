/**
 * Executor
 * 
 * Takes a plan produced by the Planner and executes each step sequentially
 * by looking up the corresponding tool in the registry.
 * 
 * Features:
 *   - Sequential step execution with per-step logging
 *   - Step result forwarding (e.g. detect_form → fill_form)
 *   - Configurable pre-step delays (via step.meta.delayBefore)
 *   - Graceful failure handling with optional continue-on-error
 *   - Execution summary with timing and status per step
 */

const logger = require('../utils/logger');
const { getTool } = require('./tool_registry');

/**
 * Execute a plan step-by-step.
 * 
 * @param {object}  plan                     - The plan object from the planner.
 * @param {object}  [options]                - Execution options.
 * @param {boolean} [options.stopOnError=true] - If true, abort on first failure.
 * @returns {Promise<object>} Execution report with per-step results.
 */
async function executePlan(plan, options = {}) {
    const stopOnError = options.stopOnError !== undefined ? options.stopOnError : true;

    logger.info(`[Executor] ═══════════════════════════════════════════════`);
    logger.info(`[Executor] Starting execution of plan: "${plan.goal}"`);
    logger.info(`[Executor] Total steps: ${plan.steps.length}`);
    logger.info(`[Executor] ═══════════════════════════════════════════════`);

    const report = {
        goal: plan.goal,
        startedAt: new Date().toISOString(),
        steps: [],
        status: 'success'
    };

    // Stores results keyed by tool name so subsequent steps can reference them.
    // e.g. detect_form returns locators → fill_form picks them up.
    const resultStore = {};

    for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const stepNumber = i + 1;
        const stepLabel = `[Step ${stepNumber}/${plan.steps.length}]`;
        const description = step.meta?.description || step.tool;

        logger.info(`[Executor] ${stepLabel} ── ${description} (tool: ${step.tool})`);

        // Look up the tool
        const tool = getTool(step.tool);
        if (!tool) {
            const errorMsg = `Tool "${step.tool}" not found in registry.`;
            logger.error(`[Executor] ${stepLabel} FAILED — ${errorMsg}`);
            report.steps.push({ step: stepNumber, tool: step.tool, status: 'error', error: errorMsg });
            report.status = 'failed';

            if (stopOnError) {
                logger.error(`[Executor] Aborting execution (stopOnError=true).`);
                break;
            }
            continue;
        }

        // Optional pre-step delay (e.g. wait for page render)
        if (step.meta?.delayBefore) {
            logger.debug(`[Executor] ${stepLabel} Waiting ${step.meta.delayBefore}ms before execution...`);
            await new Promise(r => setTimeout(r, step.meta.delayBefore));
        }

        // Resolve parameters — inject results from previous steps if needed
        const resolvedParams = resolveParams(step, resultStore);

        // Execute
        const stepStart = Date.now();
        try {
            const result = await tool.handler(resolvedParams);

            const durationMs = Date.now() - stepStart;
            logger.info(`[Executor] ${stepLabel} ✓ Completed in ${durationMs}ms`);

            // Store result for downstream steps
            if (result !== undefined) {
                resultStore[step.tool] = result;
            }

            report.steps.push({
                step: stepNumber,
                tool: step.tool,
                status: 'success',
                durationMs
            });
        } catch (error) {
            const durationMs = Date.now() - stepStart;
            logger.error(`[Executor] ${stepLabel} ✗ Failed after ${durationMs}ms — ${error.message}`);

            report.steps.push({
                step: stepNumber,
                tool: step.tool,
                status: 'error',
                error: error.message,
                durationMs
            });
            report.status = 'failed';

            if (stopOnError) {
                logger.error(`[Executor] Aborting execution (stopOnError=true).`);
                break;
            }
        }
    }

    report.finishedAt = new Date().toISOString();

    // ── Summary ──
    const succeeded = report.steps.filter(s => s.status === 'success').length;
    const failed = report.steps.filter(s => s.status === 'error').length;

    logger.info(`[Executor] ═══════════════════════════════════════════════`);
    logger.info(`[Executor] Execution complete — ${succeeded} succeeded, ${failed} failed`);
    logger.info(`[Executor] Overall status: ${report.status.toUpperCase()}`);
    logger.info(`[Executor] ═══════════════════════════════════════════════`);

    return report;
}

/**
 * Merge step params with any results from previous steps that the
 * current step depends on (declared via step.meta.requiresResult).
 * 
 * For example, fill_form needs locators from detect_form:
 *   meta: { requiresResult: 'detect_form' }
 * 
 * The result of 'detect_form' is injected as `params.locators`.
 */
function resolveParams(step, resultStore) {
    const params = { ...step.params };

    if (step.meta?.requiresResult) {
        const depTool = step.meta.requiresResult;
        const depResult = resultStore[depTool];

        if (!depResult) {
            logger.warn(`[Executor] Step "${step.tool}" requires result from "${depTool}" but none was found.`);
        } else {
            // Convention: inject the dependency result as "locators" for form tools
            // This can be generalised with a mapping if more tools need cross-step data.
            params.locators = depResult;
        }
    }

    return params;
}

module.exports = { executePlan };
