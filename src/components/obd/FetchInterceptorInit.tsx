"use client";

/**
 * Client-side fetch interceptor initialization
 * 
 * Initializes the global fetch interceptor on client-side mount.
 * This ensures all fetch calls automatically handle DEMO_READ_ONLY errors.
 */

import { useEffect } from "react";
import { initGlobalFetchInterceptor } from "@/lib/utils/global-fetch-interceptor";

export function FetchInterceptorInit() {
  useEffect(() => {
    // Initialize global fetch interceptor on client-side mount
    initGlobalFetchInterceptor();
  }, []);

  // This component doesn't render anything
  return null;
}

