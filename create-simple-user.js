// Script to create a very simple test user
const fetch = require('node-fetch');

async function createSimpleUser() {
  try {
    // Very simple credentials
    const username = 'user';
    const password = 'pass';
    const email = 'user@example.com';
    const department = '営業部';
    
    console.log(`Creating simple user with username: ${username} and password: ${password}`);
    
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
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      
      if (response.ok) {
        console.log('Simple user created successfully!');
        console.log('Login credentials:');
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
      } else {
        console.log('Failed to create simple user:', data.error);
      }
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      console.log('Raw response text:', responseText);
    }
  } catch (error) {
    console.error('Error creating simple user:', error);
  }
}

createSimpleUser();
