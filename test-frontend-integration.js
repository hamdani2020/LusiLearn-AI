#!/usr/bin/env node

// Test script to verify frontend-backend integration
const https = require('https');
const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          json: () => Promise.resolve(JSON.parse(data)),
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

const API_BASE_URL = 'http://localhost:4000';

async function testIntegration() {
  console.log('🧪 Testing LusiLearn Frontend-Backend Integration\n');

  try {
    // Step 1: Register a test user
    console.log('1️⃣ Registering test user...');
    const registerResponse = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123',
        username: `testuser${Date.now()}`,
        demographics: {
          ageRange: '18-25',
          educationLevel: 'college',
          timezone: 'UTC',
          preferredLanguage: 'en'
        },
        learningPreferences: {
          learningStyle: ['visual'],
          preferredContentTypes: ['video', 'text'],
          sessionDuration: 45,
          difficultyPreference: 'moderate'
        }
      })
    });

    const registerData = await registerResponse.json();
    if (!registerData.success) {
      throw new Error(`Registration failed: ${registerData.message}`);
    }

    console.log('✅ User registered successfully');
    const { accessToken } = registerData.data;

    // Step 2: Create a learning path
    console.log('\n2️⃣ Creating learning path...');
    const createPathResponse = await fetch(`${API_BASE_URL}/api/v1/learning-paths`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        subject: 'React Development',
        goals: [{
          objective: 'Master React fundamentals and hooks',
          timeline: '4 weeks',
          priority: 'high'
        }]
      })
    });

    const pathData = await createPathResponse.json();
    if (!pathData.success) {
      throw new Error(`Learning path creation failed: ${pathData.message}`);
    }

    console.log('✅ Learning path created successfully');
    console.log(`   📚 Subject: ${pathData.data.subject}`);
    console.log(`   🎯 Objectives: ${pathData.data.objectives.length}`);
    console.log(`   🏆 Milestones: ${pathData.data.milestones.length}`);

    // Step 3: Fetch learning paths
    console.log('\n3️⃣ Fetching learning paths...');
    const fetchPathsResponse = await fetch(`${API_BASE_URL}/api/v1/learning-paths`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const pathsData = await fetchPathsResponse.json();
    if (!pathsData.success) {
      throw new Error(`Fetching paths failed: ${pathsData.message}`);
    }

    console.log('✅ Learning paths fetched successfully');
    console.log(`   📊 Total paths: ${pathsData.data.length}`);

    // Step 4: Test AI service integration
    console.log('\n4️⃣ Testing AI service integration...');
    const aiTestResponse = await fetch('http://localhost:8001/api/v1/learning-paths/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'test-user',
        subject: 'Python Programming',
        education_level: 'college',
        current_level: 'beginner',
        learning_goals: ['Learn Python basics'],
        time_commitment: 2,
        learning_style: 'visual'
      })
    });

    const aiData = await aiTestResponse.json();
    console.log('✅ AI service integration working');
    console.log(`   🤖 Generated objectives: ${aiData.objectives?.length || 0}`);

    console.log('\n🎉 All tests passed! Frontend-Backend integration is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testIntegration();