/**
 * Tool Registry
 * 
 * Maps tool names (strings) to their implementations.
 * Each tool entry contains:
 *   - name:        Unique identifier used in execution plans
 *   - description: Human-readable summary (useful for future LLM prompting)
 *   - handler:     Async function that performs the action
 * 
 * The registry follows a plugin pattern — new tools can be registered
 * at runtime without modifying the executor or planner.
 */

const {
    open_browser,
    navigate_to_url,
    take_screenshot,
    click_on_screen,
    send_keys,
    scroll,
    double_click,
    close_browser
} = require('../tools/browser_tools');
const { detect_form_fields } = require('../tools/form_detector');
const { fill_form } = require('../tools/fill_form');

// ─── Built-in Tool Definitions ───────────────────────────────────────────────

const TOOLS = {
    open_browser: {
        name: 'open_browser',
        description: 'Launch a Chromium browser instance.',
        handler: async (params = {}) => {
            return await open_browser(params.options);
        }
    },

    navigate_to_url: {
        name: 'navigate_to_url',
        description: 'Navigate the browser to a given URL.',
        handler: async (params = {}) => {
            if (!params.url) throw new Error('navigate_to_url requires a "url" parameter.');
            return await navigate_to_url(params.url);
        }
    },

    scroll: {
        name: 'scroll',
        description: 'Scroll the page in a given direction by a specified distance in pixels.',
        handler: async (params = {}) => {
            const direction = params.direction || 'down';
            const distance = params.distance || 500;
            return await scroll(direction, distance);
        }
    },

    click_on_screen: {
        name: 'click_on_screen',
        description: 'Click on a DOM element identified by a CSS selector.',
        handler: async (params = {}) => {
            if (!params.selector) throw new Error('click_on_screen requires a "selector" parameter.');
            return await click_on_screen(params.selector);
        }
    },

    double_click: {
        name: 'double_click',
        description: 'Double-click on a DOM element identified by a CSS selector.',
        handler: async (params = {}) => {
            if (!params.selector) throw new Error('double_click requires a "selector" parameter.');
            return await double_click(params.selector);
        }
    },

    send_keys: {
        name: 'send_keys',
        description: 'Type text into an input element identified by a CSS selector.',
        handler: async (params = {}) => {
            if (!params.selector) throw new Error('send_keys requires a "selector" parameter.');
            if (params.text === undefined) throw new Error('send_keys requires a "text" parameter.');
            return await send_keys(params.selector, params.text);
        }
    },

    detect_form: {
        name: 'detect_form',
        description: 'Detect form fields (input/textarea) on the current page and return locators.',
        handler: async () => {
            return await detect_form_fields();
        }
    },

    fill_form: {
        name: 'fill_form',
        description: 'Fill detected form fields with a name and description.',
        handler: async (params = {}) => {
            if (!params.locators) throw new Error('fill_form requires "locators" from a prior detect_form step.');
            const name = params.name || '';
            const description = params.description || '';
            return await fill_form(params.locators, name, description);
        }
    },

    take_screenshot: {
        name: 'take_screenshot',
        description: 'Capture a full-page screenshot and save it to the screenshots folder.',
        handler: async (params = {}) => {
            const filename = params.filename || 'screenshot.png';
            return await take_screenshot(filename);
        }
    },

    close_browser: {
        name: 'close_browser',
        description: 'Close the browser and release all resources.',
        handler: async () => {
            return await close_browser();
        }
    }
};

// ─── Registry API ────────────────────────────────────────────────────────────

/**
 * Look up a tool by name.
 * @param {string} toolName
 * @returns {object|null} The tool definition, or null if not found.
 */
function getTool(toolName) {
    return TOOLS[toolName] || null;
}

/**
 * Register a new tool at runtime.
 * @param {string} name
 * @param {string} description
 * @param {Function} handler
 */
function registerTool(name, description, handler) {
    TOOLS[name] = { name, description, handler };
}

/**
 * List all registered tool names and descriptions.
 * Useful for constructing LLM system prompts.
 * @returns {Array<{name: string, description: string}>}
 */
function listTools() {
    return Object.values(TOOLS).map(t => ({ name: t.name, description: t.description }));
}

module.exports = { getTool, registerTool, listTools };
