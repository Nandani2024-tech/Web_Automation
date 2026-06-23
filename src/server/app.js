const express = require('express');
const cors = require('cors');
const path = require('path');
const { generatePlan, executePlan } = require('../agent');
const { close_browser } = require('../tools/browser_tools');
const logger = require('../utils/logger');


const app = express();
const PORT = process.env.PORT || 3001;


app.use(cors());
app.use(express.json());


// Serve screenshots folder statically
app.use('/screenshots', express.static(path.join(__dirname, '../../screenshots')));


// Serve the compiled React frontend statically
app.use(express.static(path.join(__dirname, '../client/dist')));


// SSE Endpoint for streaming logs
app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');


    // Send an initial connected message
    res.write(`data: ${JSON.stringify({ level: 'info', message: 'Connected to Agent Log Stream', timestamp: new Date().toISOString() })}\n\n`);


    const logListener = (logData) => {
        res.write(`data: ${JSON.stringify(logData)}\n\n`);
    };


    logger.emitter.on('log', logListener);


    req.on('close', () => {
        logger.emitter.off('log', logListener);
    });
});


// Run Endpoint
app.post('/api/run', async (req, res) => {
    const { url, goal, provider } = req.body;


    if (!url || !goal) {
        return res.status(400).json({ error: 'URL and goal are required' });
    }


    try {
        logger.info(`Starting run via API. Goal: ${goal}, Provider: ${provider}`);
       
        const plan = await generatePlan(goal, {
            url,
            name: 'Automation Agent',
            description: 'This description was automatically typed by the Website Automation Agent using Playwright!',
            scrollDistance: 500,
            screenshotName: 'filled_form.png'
        }, {
            provider: provider || 'hardcoded'
        });


        // Trigger execution asynchronously so we don't block the HTTP response
        // but wait for the result
        executePlan(plan).then(report => {
            if (report.status === 'success') {
                logger.info('Agent completed all steps successfully.');
            } else {
                logger.warn('Agent finished with errors.');
            }
            close_browser();
        }).catch(err => {
            logger.error(`Execution failed: ${err.message}`);
            close_browser();
        });


        res.json({ message: 'Automation started', plan });


    } catch (error) {
        logger.error(`Failed to start automation: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});


// Catch-all route to serve the React index.html for any other requests
app.get(/^\/.*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});


app.listen(PORT, () => {
    logger.info(`Express Server running on http://localhost:${PORT}`);
});



