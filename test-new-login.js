// Simple script to test the login API with the newly created user
const fetch = require('node-fetch');

async function testLogin() {
  try {
    const username = 'testuser595'; // Use the username from the registration test
    const password = 'password123';
    
    console.log(`Testing login with newly created user: ${username}`);
    
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
