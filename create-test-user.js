// Script to create a simple test user
const fetch = require('node-fetch');

async function createTestUser() {
  try {
    // Simple credentials that are easy to remember
    const username = 'test';
    const password = 'test123';
    const email = 'test@example.com';
    const department = '開発部';
    
    console.log(`Creating test user with username: ${username} and password: ${password}`);
    
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
    
    if (response.ok) {
      console.log('Test user created successfully!');
      console.log('Login credentials:');
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
    } else {
      console.log('Failed to create test user:', data.error);
    }
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

createTestUser();
