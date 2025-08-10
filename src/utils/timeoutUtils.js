/**
 * Utility functions for handling timeouts and async operations
 */

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5 minutes)
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise} Promise that resolves/rejects with timeout handling
 */
function withTimeout(promise, timeoutMs = 300000, operationName = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Wraps an async function with timeout and retry logic
 * @param {Function} asyncFn - The async function to wrap
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {number} options.retries - Number of retries
 * @param {string} options.operationName - Name for logging
 * @returns {Function} Wrapped function
 */
function withTimeoutAndRetry(asyncFn, options = {}) {
  const {
    timeout = 300000, // 5 minutes default
    retries = 0,
    operationName = 'Operation'
  } = options;

  return async (...args) => {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.warn(`Retrying ${operationName} (attempt ${attempt + 1}/${retries + 1})`);
        }
        
        return await withTimeout(asyncFn(...args), timeout, operationName);
      } catch (error) {
        lastError = error;
        
        if (error.message.includes('timed out')) {
          console.warn(`${operationName} timed out on attempt ${attempt + 1}`);
        } else {
          console.warn(`${operationName} failed on attempt ${attempt + 1}: ${error.message}`);
        }
        
        // Don't retry on last attempt
        if (attempt === retries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 10000)));
      }
    }
    
    throw lastError;
  };
}

/**
 * Creates a safe wrapper for analysis functions that handles timeouts gracefully
 * @param {Function} analysisFn - The analysis function to wrap
 * @param {Object} fallbackResult - Default result to return on timeout/error
 * @param {string} analysisName - Name of the analysis for logging
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Safe analysis function
 */
function createSafeAnalyzer(analysisFn, fallbackResult, analysisName, timeoutMs = 300000) {
  return async (...args) => {
    try {
      console.log(`Starting ${analysisName}...`);
      const result = await withTimeout(analysisFn(...args), timeoutMs, analysisName);
      console.log(`✅ ${analysisName} completed`);
      return result;
    } catch (error) {
      if (error.message.includes('timed out')) {
        console.warn(`⏱️  ${analysisName} timed out after ${timeoutMs / 1000} seconds, using fallback result`);
      } else {
        console.warn(`⚠️  ${analysisName} failed: ${error.message}, using fallback result`);
      }
      
      return {
        ...fallbackResult,
        error: error.message,
        timedOut: error.message.includes('timed out'),
        timestamp: new Date().toISOString()
      };
    }
  };
}

/**
 * Creates a progress-aware timeout wrapper that logs progress
 * @param {Function} asyncFn - Function to wrap
 * @param {string} operationName - Name for progress logging
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Wrapped function with progress logging
 */
function withProgressTimeout(asyncFn, operationName, timeoutMs = 300000) {
  return async (...args) => {
    const startTime = Date.now();
    let progressTimer;
    
    // Log progress every 30 seconds
    progressTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((timeoutMs - (Date.now() - startTime)) / 1000);
      console.log(`⏳ ${operationName} still running... (${elapsed}s elapsed, ${remaining}s remaining)`);
    }, 30000);
    
    try {
      const result = await withTimeout(asyncFn(...args), timeoutMs, operationName);
      clearInterval(progressTimer);
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ ${operationName} completed in ${totalTime}s`);
      return result;
    } catch (error) {
      clearInterval(progressTimer);
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.error(`❌ ${operationName} failed after ${totalTime}s: ${error.message}`);
      throw error;
    }
  };
}

module.exports = {
  withTimeout,
  withTimeoutAndRetry,
  createSafeAnalyzer,
  withProgressTimeout
};
