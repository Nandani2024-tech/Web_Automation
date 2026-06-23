const { chromium } = require('playwright');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

let browser = null;
let context = null;
let page = null;

async function open_browser(options = {}) {
    try {
        logger.info('Opening browser...');
        browser = await chromium.launch({ headless: true, ...options });
        context = await browser.newContext();
        page = await context.newPage();
        logger.info('Browser opened successfully.');
        return { browser, context, page };
    } catch (error) {
        logger.error('Failed to open browser:', error.message);
        throw error;
    }
}

async function navigate_to_url(url) {
    try {
        if (!page) throw new Error('Browser page is not initialized. Call open_browser first.');
        logger.info(`Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle' });
        logger.info(`Successfully navigated to ${url}`);
    } catch (error) {
        logger.error(`Failed to navigate to ${url}:`, error.message);
        throw error;
    }
}

async function take_screenshot(filename = 'screenshot.png') {
    try {
        if (!page) throw new Error('Browser page is not initialized.');
        
        // Ensure screenshots directory exists at the root of the project
        const screenshotsDir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        // Ensure filename has an extension
        if (!filename.includes('.')) {
            filename += '.png';
        }

        const filePath = path.join(screenshotsDir, filename);
        logger.info(`Taking screenshot: ${filePath}`);
        await page.screenshot({ path: filePath, fullPage: false });
        logger.info(`Screenshot saved to ${filePath}`);
        return filePath;
    } catch (error) {
        logger.error('Failed to take screenshot:', error.message);
        throw error;
    }
}

async function click_on_screen(selector) {
    try {
        if (!page) throw new Error('Browser page is not initialized.');
        logger.info(`Clicking on selector: ${selector}`);
        await page.click(selector);
        logger.info(`Clicked on ${selector}`);
    } catch (error) {
        logger.error(`Failed to click on ${selector}:`, error.message);
        throw error;
    }
}

async function send_keys(selector, text) {
    try {
        if (!page) throw new Error('Browser page is not initialized.');
        logger.info(`Sending keys to ${selector}`);
        await page.fill(selector, text);
        logger.info(`Sent keys to ${selector}`);
    } catch (error) {
        logger.error(`Failed to send keys to ${selector}:`, error.message);
        throw error;
    }
}

async function scroll(direction = 'down', distance = 500) {
    try {
        if (!page) throw new Error('Browser page is not initialized.');
        logger.info(`Scrolling ${direction} by ${distance} pixels`);
        await page.evaluate(({ dir, dist }) => {
            if (dir === 'down') {
                window.scrollBy(0, dist);
            } else if (dir === 'up') {
                window.scrollBy(0, -dist);
            }
        }, { dir: direction, dist: distance });
        logger.info(`Scrolled ${direction}`);
    } catch (error) {
        logger.error('Failed to scroll:', error.message);
        throw error;
    }
}

async function double_click(selector) {
    try {
        if (!page) throw new Error('Browser page is not initialized.');
        logger.info(`Double clicking on selector: ${selector}`);
        await page.dblclick(selector);
        logger.info(`Double clicked on ${selector}`);
    } catch (error) {
        logger.error(`Failed to double click on ${selector}:`, error.message);
        throw error;
    }
}

async function close_browser() {
     try {
         if (browser) {
             logger.info('Closing browser...');
             await browser.close();
             logger.info('Browser closed.');
         }
     } catch (error) {
         logger.error('Failed to close browser:', error.message);
     }
}

function get_page() {
    if (!page) throw new Error('Browser page is not initialized.');
    return page;
}

// Exporting each tool separately
module.exports = {
    open_browser,
    navigate_to_url,
    take_screenshot,
    click_on_screen,
    send_keys,
    scroll,
    double_click,
    close_browser,
    get_page
};
