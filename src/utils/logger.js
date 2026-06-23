const EventEmitter = require('events');

class LoggerEmitter extends EventEmitter {}
const logEmitter = new LoggerEmitter();

const log = (level, message, ...args) => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(formattedMessage, ...args);
    // Emit for SSE
    logEmitter.emit('log', { level, message, timestamp, args });
};

module.exports = {
    info: (message, ...args) => log('info', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    error: (message, ...args) => log('error', message, ...args),
    debug: (message, ...args) => log('debug', message, ...args),
    emitter: logEmitter // Export emitter so the server can listen
};
