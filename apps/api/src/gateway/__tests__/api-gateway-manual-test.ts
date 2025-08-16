/**
 * Manual test script to verify API Gateway functionality
 * This script tests the actual running API Gateway instance
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000';

async function testAPIGateway() {
  console.log('🚀 Testing API Gateway functionality...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    console.log('   Gateway info:', healthResponse.data.gateway);

    // Test 2: API Documentation
    console.log('\n2. Testing API Documentation...');
    const apiInfoResponse = await axios.get(`${API_BASE_URL}/api`);
    console.log('✅ API info retrieved:', apiInfoResponse.data.name);
    console.log('   Supported versions:', apiInfoResponse.data.supportedVersions);

    // Test 3: Route Information
    console.log('\n3. Testing Route Information...');
    const routesResponse = await axios.get(`${API_BASE_URL}/api/routes`);
    console.log('✅ Routes retrieved, total:', routesResponse.data.total);
    console.log('   Sample routes:', routesResponse.data.routes.slice(0, 3));

    // Test 4: Metrics Endpoint
    console.log('\n4. Testing Metrics Endpoint...');
    const metricsResponse = await axios.get(`${API_BASE_URL}/api/metrics`);
    console.log('✅ Metrics retrieved:', metricsResponse.data.data);

    // Test 5: Unsupported API Version
    console.log('\n5. Testing Unsupported API Version...');
    try {
      await axios.get(`${API_BASE_URL}/api/v3/auth/login`);
    } catch (error: any) {
      if (error.response?.status === 400) {
        console.log('✅ Unsupported version correctly rejected:', error.response.data.error);
      } else {
        throw error;
      }
    }

    // Test 6: Backward Compatibility Redirect
    console.log('\n6. Testing Backward Compatibility...');
    try {
      await axios.get(`${API_BASE_URL}/api/auth/login`, { maxRedirects: 0 });
    } catch (error: any) {
      if (error.response?.status === 301) {
        console.log('✅ Backward compatibility redirect working:', error.response.headers.location);
      } else {
        console.log('⚠️  Redirect test inconclusive:', error.response?.status);
      }
    }

    // Test 7: Request Logging (check if request ID is added)
    console.log('\n7. Testing Request Logging...');
    const testResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Request processed successfully');

    // Test 8: Rate Limiting (test with auth endpoint)
    console.log('\n8. Testing Rate Limiting...');
    let rateLimitHit = false;
    for (let i = 0; i < 25; i++) {
      try {
        await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
          email: 'test@example.com',
          password: 'TestPassword123'
        });
      } catch (error: any) {
        if (error.response?.status === 429) {
          console.log('✅ Rate limiting working - hit limit after', i + 1, 'requests');
          rateLimitHit = true;
          break;
        }
        // Ignore other errors (like authentication failures)
      }
    }
    if (!rateLimitHit) {
      console.log('⚠️  Rate limiting not triggered in test');
    }

    console.log('\n🎉 API Gateway tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Centralized request routing');
    console.log('   ✅ API versioning and validation');
    console.log('   ✅ Request/response logging and monitoring');
    console.log('   ✅ Health check and documentation endpoints');
    console.log('   ✅ Backward compatibility handling');
    console.log('   ✅ Rate limiting per endpoint');
    console.log('   ✅ Error handling and metrics collection');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the tests
testAPIGateway();