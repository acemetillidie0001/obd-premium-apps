/**
 * k6 Load Test for OBD Scheduler
 * P1-27: No Load Testing
 * 
 * Run with: k6 run tests/load/scheduler-load.js
 * 
 * Environment variables:
 * - K6_BASE_URL: Base URL (default: http://localhost:3000)
 * - K6_BOOKING_KEY: Valid booking key for testing (required)
 * - K6_VUS: Number of virtual users (default: 10)
 * - K6_DURATION: Test duration (default: 30s)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");

// Configuration
const baseURL = __ENV.K6_BASE_URL || "http://localhost:3000";
const bookingKey = __ENV.K6_BOOKING_KEY || "";
const vus = parseInt(__ENV.K6_VUS || "10");
const duration = __ENV.K6_DURATION || "30s";

export const options = {
  stages: [
    { duration: "10s", target: vus }, // Ramp up
    { duration: duration, target: vus }, // Stay at target
    { duration: "10s", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests should be below 2s
    http_req_failed: ["rate<0.1"], // Error rate should be less than 10%
    errors: ["rate<0.1"],
  },
};

export default function () {
  // Test 1: Public context route
  const contextRes = http.get(`${baseURL}/api/obd-scheduler/public/context?bookingKey=${bookingKey}`);
  const contextCheck = check(contextRes, {
    "context status is 200": (r) => r.status === 200,
    "context response has bookingKey": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true && body.data !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!contextCheck);
  sleep(1);

  // Test 2: Create booking request
  if (bookingKey) {
    const requestPayload = JSON.stringify({
      bookingKey: bookingKey,
      customerName: `Test User ${__VU}-${__ITER}`,
      customerEmail: `test${__VU}-${__ITER}@example.com`,
      customerPhone: "555-0000",
      message: "Load test request",
    });

    const createRes = http.post(`${baseURL}/api/obd-scheduler/requests`, requestPayload, {
      headers: { "Content-Type": "application/json" },
    });

    const createCheck = check(createRes, {
      "create request status is 200 or 429": (r) => r.status === 200 || r.status === 429,
      "create request has valid response": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.ok !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!createCheck);
    sleep(1);
  }

  // Test 3: Metrics endpoint (if authenticated - would need auth token in real scenario)
  // For now, we'll skip authenticated endpoints in load test
  // In production, you'd add auth token handling here
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

