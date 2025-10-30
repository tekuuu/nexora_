function containsAny(message: string, keywords: string[]): boolean {
    const lowerMessage = message.toLowerCase();
    return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

function sanitizeErrorMessage(message: string): string {
    let sanitized = message;

    // Remove contract addresses (0x followed by 40 hex characters)
    sanitized = sanitized.replace(/0x[a-fA-F0-9]{40}/g, '');

    // Remove transaction hashes (0x followed by 64 hex characters)
    sanitized = sanitized.replace(/0x[a-fA-F0-9]{64}/g, '');

    // Remove URLs (http/https links)
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '');

    // Remove version strings (e.g., @2.37.13)
    sanitized = sanitized.replace(/@\d+\.\d+\.\d+/g, '');

    // Remove "Request Arguments:" and everything after it
    const requestArgsIndex = sanitized.indexOf("Request Arguments:");
    if (requestArgsIndex !== -1) {
        sanitized = sanitized.substring(0, requestArgsIndex);
    }

    // Remove "Contract Call:" and everything after it
    const contractCallIndex = sanitized.indexOf("Contract Call:");
    if (contractCallIndex !== -1) {
        sanitized = sanitized.substring(0, contractCallIndex);
    }

    // Remove "Details:" and everything after it
    const detailsIndex = sanitized.indexOf("Details:");
    if (detailsIndex !== -1) {
        sanitized = sanitized.substring(0, detailsIndex);
    }

    // Trim whitespace
    sanitized = sanitized.trim();

    // Truncate to first 150 characters if still too long
    if (sanitized.length > 150) {
        sanitized = sanitized.substring(0, 150) + '...';
    }

    return sanitized;
}

export function parseTransactionError(error: any): string {
    if (error == null) {
        return "An unexpected error occurred. Please try again.";
    }

    let message: string;
    if (typeof error === 'string') {
        message = error;
    } else if (error.shortMessage) {
        message = error.shortMessage;
    } else if (error.message) {
        message = error.message;
    } else {
        message = String(error);
    }

    // HTTP 429 Rate Limit Detection
    if (containsAny(message, ["429", "rate limit", "too many requests"])) {
        return "Network rate limit reached. Please wait a moment and try again, or switch to a different RPC provider.";
    }

    // User Rejection Detection
    if (containsAny(message, ["user rejected", "user denied", "rejected the request", "user cancel", "user declined"])) {
        return "Transaction cancelled. No action was taken.";
    }

    // Insufficient Funds Detection
    if (containsAny(message, ["insufficient funds", "insufficient balance", "exceeds balance", "not enough"])) {
        return "Insufficient funds to complete this transaction. Please check your balance and try again.";
    }

    // Network/Connection Errors
    if (containsAny(message, ["network", "connection", "timeout", "failed to fetch", "econnrefused"])) {
        return "Network connection error. Please check your internet connection and try again.";
    }

    // Contract Revert Errors
    if (containsAny(message, ["revert", "execution reverted", "transaction failed"])) {
        return "Transaction failed on-chain. This may be due to insufficient collateral, invalid parameters, or contract restrictions.";
    }

    // Gas Estimation Errors
    if (containsAny(message, ["gas required exceeds", "out of gas", "gas estimation failed"])) {
        return "Unable to estimate gas for this transaction. Please check your inputs and try again.";
    }

    // Nonce Errors
    if (containsAny(message, ["nonce", "nonce too low", "nonce too high"])) {
        return "Transaction nonce error. Please refresh the page and try again.";
    }

    // Generic Fallback
    const sanitized = sanitizeErrorMessage(message);
    if (sanitized.trim().length === 0) {
        return "Transaction failed. Please try again.";
    }
    return sanitized;
}