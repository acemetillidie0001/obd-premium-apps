# Load Testing with k6

## Overview

This directory contains k6 load test scripts for the OBD Scheduler application.

## Prerequisites

Install k6:
- macOS: `brew install k6`
- Linux: See [k6 installation guide](https://k6.io/docs/getting-started/installation/)
- Windows: Download from [k6 releases](https://github.com/grafana/k6/releases)

## Environment Variables

- `K6_BASE_URL`: Base URL for the application (default: `http://localhost:3000`)
- `K6_BOOKING_KEY`: Valid booking key for testing (required for request creation tests)
- `K6_VUS`: Number of virtual users (default: `10`)
- `K6_DURATION`: Test duration (default: `30s`)

## Running Tests

### Basic Run

```bash
K6_BOOKING_KEY=your-booking-key k6 run tests/load/scheduler-load.js
```

### Custom Configuration

```bash
K6_BASE_URL=http://localhost:3000 \
K6_BOOKING_KEY=your-booking-key \
K6_VUS=20 \
K6_DURATION=60s \
k6 run tests/load/scheduler-load.js
```

### Production Testing

⚠️ **Warning**: Only run load tests against production with explicit permission and during maintenance windows.

```bash
K6_BASE_URL=https://your-production-url.com \
K6_BOOKING_KEY=production-booking-key \
K6_VUS=5 \
K6_DURATION=30s \
k6 run tests/load/scheduler-load.js
```

## Test Scenarios

The load test covers:
1. **Public Context Route**: Tests the public booking context endpoint
2. **Create Request Route**: Tests booking request creation (requires valid bookingKey)

## Thresholds

The test defines the following thresholds:
- 95% of requests should complete in under 2 seconds
- Error rate should be less than 10%

## CI/CD

Load tests are **not** run in CI by default due to:
- Resource requirements
- Potential impact on shared test environments
- Need for valid test data (booking keys)

Run load tests manually before major releases or when performance changes are made.

## Notes

- The test uses a ramp-up/ramp-down pattern to avoid sudden spikes
- Each virtual user sleeps 1 second between requests to simulate realistic behavior
- Rate limiting (429 responses) are considered acceptable and don't fail the test

