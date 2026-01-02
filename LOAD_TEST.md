# Load Testing Guide

This document describes how to run load tests for the OBD Scheduler application using k6.

## Prerequisites

### Installing k6

k6 is **not** installed as an npm dependency. You need to install it separately on your system.

#### macOS
```bash
brew install k6
```

#### Linux
```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or using package manager from k6 docs:
# See https://k6.io/docs/getting-started/installation/
```

#### Windows
1. Download the latest release from [k6 releases page](https://github.com/grafana/k6/releases)
2. Extract the zip file
3. Add k6.exe to your system PATH
4. Or use Chocolatey: `choco install k6`

#### Verify Installation
```bash
k6 version
```

## Running Load Tests

### Basic Usage

The load test script requires a valid `BOOKING_KEY` environment variable:

```bash
BOOKING_KEY=your-booking-key k6 run tests/load/k6-scheduler.js
```

### Using the npm Script

You can also use the package.json script (requires k6 to be installed):

```bash
BOOKING_KEY=your-booking-key pnpm test:load
```

**Note**: If k6 is not installed, the command will fail. Install k6 first (see Prerequisites above).

### Environment Variables

- **BASE_URL** (optional): Base URL for the application
  - Default: `http://localhost:3000`
  - Example: `BASE_URL=http://localhost:3000`

- **BOOKING_KEY** (required): Valid booking key for testing
  - Must be a valid booking key from your database
  - Example: `BOOKING_KEY=abc123xyz`

### Custom Configuration

The load test uses safe defaults (5 VUs, 30s duration). To customize, modify the `options` in `tests/load/k6-scheduler.js`:

```javascript
export const options = {
  vus: 5,           // Number of virtual users
  duration: "30s",  // Test duration
  // ...
};
```

### Example Commands

```bash
# Test against local development server
BOOKING_KEY=test-key-123 k6 run tests/load/k6-scheduler.js

# Test against custom URL
BASE_URL=http://localhost:3001 BOOKING_KEY=test-key-123 k6 run tests/load/k6-scheduler.js

# Using npm script
BOOKING_KEY=test-key-123 pnpm test:load
```

## Test Scenarios

The load test covers two endpoints:

1. **GET /api/obd-scheduler/public/context?bookingKey=...**
   - Tests the public booking context endpoint
   - Verifies response structure and status code

2. **POST /api/obd-scheduler/requests**
   - Tests booking request creation
   - Uses valid payload with unique customer data per VU/iteration
   - Accepts 200, 201, or 429 (rate limited) as valid responses

## Test Thresholds

The test defines the following performance thresholds:
- **95% of requests** should complete in under 2 seconds
- **Error rate** should be less than 10%

If thresholds are exceeded, the test will fail.

## ⚠️ Important Warnings

### Production Testing

**DO NOT run load tests against production without explicit permission.**

Load tests can:
- Generate significant load on the server
- Create test data in the database
- Trigger rate limiting and notifications
- Impact real users and business operations

**If you need to test production:**
1. Get explicit permission from the team
2. Schedule during a maintenance window
3. Use minimal VUs and duration
4. Clean up test data afterward
5. Monitor server resources during the test

### Local Testing Recommendations

- Ensure your local development server is running (`pnpm dev`)
- Use a valid `BOOKING_KEY` from your local database
- Monitor database for test data creation
- Consider cleaning up test requests after testing

## Troubleshooting

### "k6: command not found"

k6 is not installed. See [Prerequisites](#prerequisites) above to install k6.

### "BOOKING_KEY environment variable is required"

Set the `BOOKING_KEY` environment variable:
```bash
BOOKING_KEY=your-booking-key k6 run tests/load/k6-scheduler.js
```

### High error rates

- Check that your server is running
- Verify the `BOOKING_KEY` is valid
- Check server logs for errors
- Ensure database connection is working
- Consider reducing VUs or duration

### Rate limiting (429 responses)

Rate limiting is expected behavior and does not cause test failure. If you're hitting rate limits frequently:
- Reduce the number of VUs
- Increase sleep time between requests
- Check rate limit configuration in the API

## CI/CD

Load tests are **not** run in CI/CD by default due to:
- Resource requirements
- Potential impact on shared test environments
- Need for valid test data (booking keys)
- k6 must be installed separately (not an npm dependency)

Run load tests manually before major releases or when performance changes are made.

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Installation Guide](https://k6.io/docs/getting-started/installation/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
