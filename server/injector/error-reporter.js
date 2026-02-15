(function () {
    // Visor Error Reporter
    // Captures browser errors and sends them to the Visor backend for visualization
    const VISOR_PORT = 3333;
    const VISOR_URL = `http://localhost:${VISOR_PORT}/api/browser-error`;
    
    // Working directory - set by the server when serving the script
    const WORKING_DIR = "";

    function sendError(errorData) {
        fetch(VISOR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...errorData,
                workingDir: WORKING_DIR
            })
        }).catch(err => {
            // Silently fail if Visor is not running to avoid console spam
        });
    }

    // Capture Global Errors
    // window.onerror gives us: message, source, lineno, colno, error
    window.addEventListener('error', (event) => {
        // event is an ErrorEvent
        const error = {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            stack: event.error ? event.error.stack : null,
            type: 'GlobalError'
        };
        sendError(error);
    });

    // Capture Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
        let message = 'Unhandled Promise Rejection';
        let stack = null;

        if (event.reason instanceof Error) {
            message = event.reason.message;
            stack = event.reason.stack;
        } else {
            message = String(event.reason);
        }

        const error = {
            message: message,
            filename: null, // Often not available in rejection, will try to parse from stack
            line: null,
            column: null,
            stack: stack,
            type: 'PromiseRejection'
        };
        sendError(error);
    });

    console.log('[Visor] Error reporter active. Errors will be sent to Visor.' + (WORKING_DIR ? ' Working directory: ' + WORKING_DIR : ''));
})();
