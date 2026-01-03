// Global Error Handler for External Services
// Suppresses errors from external services that we can't control

(function() {
    'use strict';
    
    // List of external service errors to suppress
    const suppressedErrors = [
        'exp.notion.so',
        'http-inputs-notion.splunkcloud.com', 
        'connect.facebook.net',
        'o324374.ingest.sentry.io',
        'splunk server',
        'ERR_BLOCKED_BY_CLIENT',
        'Failed to fetch',
        'HttpRequestError: Received HTTP 401',
        'Amplitude Logger',
        'Event not tracked',
        'Statsig',
        'Failed to flush events',
        'A networking error occurred',
        'TypeError: Failed to fetch',
        'no destination plugins',
        'FeatureFlagTransactionQueue',
        'clientCookieHelpers',
        'shouldShowError',
        'statsig: initialize',
        'useLoadFirstPageChunk',
        'Resource Sentinel',
        'Slow network is detected',
        'Creating multiple Statsig clients',
        'handleRestrictedStateForResponse',
        'Failed to connect to splunk server'
    ];
    
    // Function to check if error should be suppressed
    function shouldSuppress(message) {
        return suppressedErrors.some(suppressed => 
            message.includes(suppressed)
        );
    }
    
    // Override console methods
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const message = args.join(' ');
        if (!shouldSuppress(message)) {
            originalConsoleError.apply(console, args);
        }
    };
    
    const originalConsoleWarn = console.warn;
    console.warn = function(...args) {
        const message = args.join(' ');
        if (!shouldSuppress(message)) {
            originalConsoleWarn.apply(console, args);
        }
    };
    
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        const message = args.join(' ');
        if (!shouldSuppress(message)) {
            originalConsoleLog.apply(console, args);
        }
    };
    
    // Override fetch to suppress external service network errors
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && shouldSuppress(url)) {
            // Return a resolved promise for suppressed URLs
            return Promise.resolve(new Response());
        }
        return originalFetch.apply(this, args);
    };
    
    // Global error handlers
    window.addEventListener('error', function(event) {
        const message = event.message || '';
        if (shouldSuppress(message)) {
            event.preventDefault();
            return false;
        }
        return true;
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        const message = event.reason?.message || event.reason || '';
        if (shouldSuppress(message)) {
            event.preventDefault();
            return false;
        }
        return true;
    });
    
    console.log('✅ Aggressive external service error handler initialized');
})();
