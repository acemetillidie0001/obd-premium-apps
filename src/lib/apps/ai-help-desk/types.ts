/**
 * OBD AI Help Desk (V3) - Type Definitions
 * 
 * Type definitions for the AI Help Desk application that integrates
 * with AnythingLLM for business-specific search and chat functionality.
 */

/**
 * Search Result from AnythingLLM
 */
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  sourceType?: string; // FAQ, Policy, Service, Guide, etc.
  score?: number;
}

/**
 * Search Request
 */
export interface SearchRequest {
  businessId: string;
  query: string;
  limit?: number; // Default: 10
}

/**
 * Search Response
 */
export interface SearchResponse {
  ok: true;
  data: {
    results: SearchResult[];
  };
}

/**
 * Search Error Response
 */
export interface SearchErrorResponse {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Chat Source (reference to knowledge base item)
 */
export interface ChatSource {
  id: string;
  title: string;
  snippet?: string;
}

/**
 * Chat Request
 */
export interface ChatRequest {
  businessId: string;
  message: string;
  threadId?: string; // Optional thread ID for conversation continuity
}

/**
 * Chat Response
 */
export interface ChatResponse {
  ok: true;
  data: {
    threadId?: string;
    answer: string;
    sources?: ChatSource[];
  };
}

/**
 * Chat Error Response
 */
export interface ChatErrorResponse {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Normalized AnythingLLM Search Response (internal)
 */
export interface AnythingLLMSearchResponse {
  results: SearchResult[];
}

/**
 * Normalized AnythingLLM Chat Response (internal)
 */
export interface AnythingLLMChatResponse {
  threadId?: string;
  answer: string;
  sources?: ChatSource[];
}

