// Simple script to test the login API with the simple test user
const fetch = require('node-fetch');

async function testLogin() {
  try {
    const username = 'test'; // Simple test user
    const password = 'test123';
    
    console.log(`Testing login with simple test user: ${username}`);
    
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('Login successful!');
    } else {
      console.log('Login failed:', data.error);
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testLogin();
