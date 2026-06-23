const logger = require('../utils/logger');

async function fill_form(locators, name, description) {
    try {
        logger.info('Filling form...');
        
        const { nameLocator, descriptionLocator } = locators;
        
        if (nameLocator) {
            logger.info(`Filling Name with: ${name}`);
            await nameLocator.fill(name);
        }

        if (descriptionLocator) {
            logger.info(`Filling Description with: ${description}`);
            await descriptionLocator.fill(description);
        }

        logger.info('Form filled successfully.');
    } catch (error) {
        logger.error('Failed to fill form:', error.message);
        throw error;
    }
}

module.exports = {
    fill_form
};
