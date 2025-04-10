// Simple script to test the login API with the simple user
const fetch = require('node-fetch');

async function testLogin() {
  try {
    const username = 'user'; // Simple user
    const password = 'pass';
    
    console.log(`Testing login with simple user: ${username}`);
    
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
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      
      if (response.ok) {
        console.log('Login successful!');
      } else {
        console.log('Login failed:', data.error);
      }
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      console.log('Raw response text:', responseText);
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testLogin();
