const { get_page } = require('./browser_tools');
const logger = require('../utils/logger');

async function detect_form_fields() {
    try {
        const page = get_page();
        logger.info('Detecting form fields...');

        // Finding locators for Name (usually a textbox) and Description (usually a textarea)
        // We use generic selectors since we want to find the first input and textarea for the demo
        const nameLocator = page.locator('input[type="text"], input[name="username"]').first();
        const descriptionLocator = page.locator('textarea').first();

        // Wait for elements to be attached if possible
        await nameLocator.waitFor({ state: 'attached', timeout: 5000 }).catch(() => logger.warn('Name locator not found immediately'));
        await descriptionLocator.waitFor({ state: 'attached', timeout: 5000 }).catch(() => logger.warn('Description locator not found immediately'));

        logger.info('Form fields detected successfully.');
        
        return {
            nameLocator,
            descriptionLocator
        };
    } catch (error) {
        logger.error('Failed to detect form fields:', error.message);
        throw error;
    }
}

module.exports = {
    detect_form_fields
};
