// command-listener.mjs
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = 9000; // Port for internal communication from Wasp backend
const WORKSPACE_DIR = '/workspaces'; // Directory where project code is mounted

console.log(`[${new Date().toISOString()}] Starting command listener on port ${PORT}...`);

const server = http.createServer(async (req, res) => {
    const requestStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] Received request: ${req.method} ${req.url}`);

    if (req.method === 'POST' && req.url === '/execute-cline') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });

        req.on('end', async () => {
            try {
                console.log(`[${new Date().toISOString()}] Request body received: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`); // Log truncated body
                if (!body) {
                    throw new Error('Empty request body received.');
                }

                const payload = JSON.parse(body);
                const command = payload.command;

                if (!command || typeof command !== 'string') {
                    throw new Error('Invalid command payload. Expected { "command": "string" }');
                }

                // --- VERY IMPORTANT SECURITY CHECK ---
                // Only allow commands that start with 'cline '.
                // In a production environment, you MUST implement more robust validation
                // and sanitization to prevent command injection vulnerabilities.
                // Consider an allow-list of specific cline subcommands/patterns.
                if (!command.trim().startsWith('cline ')) {
                    throw new Error('Invalid command format. Only `cline` commands are permitted.');
                }
                // --- END SECURITY CHECK ---

                console.log(`[${new Date().toISOString()}] Executing command in ${WORKSPACE_DIR}: ${command}`);
                const executionStartTime = Date.now();

                // Execute the command within the workspace directory
                const { stdout, stderr } = await execAsync(command, {
                    cwd: WORKSPACE_DIR,
                    env: { ...process.env }, // Pass environment variables (like OPENROUTER_API_KEY)
                    timeout: 60000 // Add a timeout (e.g., 60 seconds)
                });

                const executionEndTime = Date.now();
                console.log(`[${new Date().toISOString()}] Command execution finished in ${executionEndTime - executionStartTime}ms.`);

                if (stdout) {
                    console.log(`[${new Date().toISOString()}] Command stdout:\n${stdout}`);
                }
                if (stderr) {
                    // cline might use stderr for progress/info, log but don't necessarily treat as error
                    console.warn(`[${new Date().toISOString()}] Command stderr:\n${stderr}`);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, stdout: stdout || '', stderr: stderr || '' }));

            } catch (error) {
                const errorEndTime = Date.now();
                console.error(`[${new Date().toISOString()}] Error processing command after ${errorEndTime - requestStartTime}ms:`, error);
                let statusCode = 500;
                let errorMessage = 'Internal Server Error processing command.';

                if (error instanceof SyntaxError) {
                    statusCode = 400; // Bad Request - Invalid JSON
                    errorMessage = 'Invalid JSON payload.';
                } else if (error.message.includes('Invalid command payload') || error.message.includes('Invalid command format')) {
                    statusCode = 400; // Bad Request - Invalid command content
                    errorMessage = error.message;
                } else if (error.code === 'ETIMEDOUT') {
                    statusCode = 504; // Gateway Timeout
                    errorMessage = 'Command execution timed out.';
                }
                else if (error.stderr || error.stdout) {
                    // If exec failed but produced output, include it
                    console.error(`[${new Date().toISOString()}] Failed command stdout: ${error.stdout}`);
                    console.error(`[${new Date().toISOString()}] Failed command stderr: ${error.stderr}`);
                    errorMessage = `Command failed: ${error.message}`;
                    // Keep statusCode 500 unless stderr indicates a specific client-side issue
                }

                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: errorMessage, details: error.stderr || '' }));
            }
        });

        req.on('error', (err) => {
            console.error(`[${new Date().toISOString()}] Request error: ${err.message}`);
            // Cannot send response header here as the request itself failed
        });

    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Not Found. Only POST /execute-cline is supported.' }));
    }
});

server.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Server error: ${err.message}`);
    // Handle specific errors like EADDRINUSE
    if (err.code === 'EADDRINUSE') {
        console.error(`[${new Date().toISOString()}] Port ${PORT} is already in use. Is another listener running?`);
        process.exit(1); // Exit if port is blocked
    }
});

server.listen(PORT, '0.0.0.0', () => { // Listen on all available network interfaces
    console.log(`[${new Date().toISOString()}] Command listener successfully started. Listening on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`[${new Date().toISOString()}] Received ${signal}. Closing command listener...`);
    server.close(() => {
        console.log(`[${new Date().toISOString()}] HTTP server closed.`);
        // Wait a moment for logs to flush before exiting
        setTimeout(() => process.exit(0), 100);
    });
    // Force exit after timeout if server doesn't close gracefully
    setTimeout(() => {
        console.error(`[${new Date().toISOString()}] Could not close connections in time, forcefully shutting down`);
        process.exit(1);
    }, 5000); // 5 seconds timeout
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); // Handle Ctrl+C

process.on('uncaughtException', (err, origin) => {
    console.error(`[${new Date().toISOString()}] Uncaught Exception at: ${origin}, Error: ${err.stack || err}`);
    // Consider whether to exit here depending on the severity
    // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
    // Consider whether to exit here
    // process.exit(1);
});