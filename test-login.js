// Simple script to test the login API
const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('Testing login with admin credentials...');
    
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
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
