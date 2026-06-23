/**
 * Agent Module — public API
 * 
 * Re-exports the core agent components so consumers can import from
 * a single path:  require('./src/agent')
 */

const { generatePlan, validatePlan } = require('./planner');
const { executePlan } = require('./executor');
const { getTool, registerTool, listTools } = require('./tool_registry');

module.exports = {
    // Planner
    generatePlan,
    validatePlan,

    // Executor
    executePlan,

    // Tool Registry
    getTool,
    registerTool,
    listTools
};
