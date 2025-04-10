// Simple script to test the registration API
const fetch = require('node-fetch');

async function testRegister() {
  try {
    console.log('Testing registration with new user credentials...');
    
    const username = 'testuser' + Math.floor(Math.random() * 1000); // Generate random username
    const password = 'password123';
    const email = 'test@example.com';
    const department = '開発部';
    
    console.log(`Registering user: ${username}`);
    
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password,
        email,
        department
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('Registration successful!');
      console.log('User can now login with:');
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
    } else {
      console.log('Registration failed:', data.error);
    }
  } catch (error) {
    console.error('Error testing registration:', error);
  }
}

testRegister();
