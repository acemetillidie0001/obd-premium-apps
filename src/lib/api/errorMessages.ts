/**
 * User-Friendly Error Message Formatter
 * 
 * Converts API error codes and messages into clear, friendly messages
 * with actionable next steps for users.
 */

interface ApiErrorResponse {
  ok: false;
  error?: string;
  code?: string;
  details?: Array<{ path?: string[]; message?: string }>;
}

/**
 * Format error message for display to users
 */
export function formatUserErrorMessage(
  error: unknown,
  jsonResponse?: ApiErrorResponse,
  statusCode?: number
): string {
  // Handle API error response with code
  if (jsonResponse?.code) {
    switch (jsonResponse.code) {
      case "UNAUTHORIZED":
        return "Please sign in to use this feature. Click the login button to get started.";
      
      case "PREMIUM_REQUIRED":
        return "This feature requires a Premium subscription. Upgrade your account to access all AI tools.";
      
      case "RATE_LIMITED":
        return "You've made too many requests. Please wait a minute and try again.";
      
      case "OPENAI_TIMEOUT":
        return "The AI took too long to respond. Please try again—this usually works on the second attempt.";
      
      case "OPENAI_API_ERROR":
        return "The AI service is temporarily unavailable. Please try again in a moment.";
      
      case "VALIDATION_ERROR":
        // Handle validation errors with field-specific messages
        if (jsonResponse.details && Array.isArray(jsonResponse.details) && jsonResponse.details.length > 0) {
          const fieldErrors = jsonResponse.details
            .filter(d => d.path && d.path.length > 0 && d.message)
            .map(d => {
              const fieldName = d.path!.join(' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
              return `${fieldName}: ${d.message}`;
            });
          
          if (fieldErrors.length > 0) {
            return `Please check your input:\n${fieldErrors.join('\n')}`;
          }
        }
        return jsonResponse.error || "Please check your input and try again.";
      
      case "UNEXPECTED_ERROR":
        return "Something unexpected happened. Please try again, and if the problem persists, contact support.";
      
      default:
        // Use the error message if provided, otherwise generic message
        if (jsonResponse.error) {
          return jsonResponse.error;
        }
    }
  }

  // Handle HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return "Please sign in to use this feature. Click the login button to get started.";
      
      case 403:
        return "This feature requires a Premium subscription. Upgrade your account to access all AI tools.";
      
      case 429:
        return "You've made too many requests. Please wait a minute and try again.";
      
      case 400:
        // Validation error - try to extract field errors
        if (jsonResponse?.details && Array.isArray(jsonResponse.details) && jsonResponse.details.length > 0) {
          const fieldErrors = jsonResponse.details
            .filter(d => d.path && d.path.length > 0 && d.message)
            .map(d => {
              const fieldName = d.path!.join(' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
              return `${fieldName}: ${d.message}`;
            });
          
          if (fieldErrors.length > 0) {
            return `Please check your input:\n${fieldErrors.join('\n')}`;
          }
        }
        return jsonResponse?.error || "Please check your input and try again.";
      
      case 504:
        return "The AI took too long to respond. Please try again—this usually works on the second attempt.";
      
      case 500:
        return "Something went wrong on our end. Please try again in a moment.";
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    const errorMessage = error.message;
    
    // Check for common error patterns
    if (errorMessage.includes("UNAUTHORIZED") || errorMessage.includes("Authentication required")) {
      return "Please sign in to use this feature. Click the login button to get started.";
    }
    
    if (errorMessage.includes("PREMIUM") || errorMessage.includes("Premium access required")) {
      return "This feature requires a Premium subscription. Upgrade your account to access all AI tools.";
    }
    
    if (errorMessage.includes("Rate limit") || errorMessage.includes("too many requests")) {
      return "You've made too many requests. Please wait a minute and try again.";
    }
    
    if (errorMessage.includes("timeout") || errorMessage.includes("took too long")) {
      return "The AI took too long to respond. Please try again—this usually works on the second attempt.";
    }
    
    // Return the error message if it's already user-friendly
    return errorMessage;
  }

  // Generic fallback
  return "Something went wrong. Please try again, and if the problem persists, contact support.";
}

