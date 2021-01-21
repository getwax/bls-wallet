import https from 'http';

import wallet from '../app/wallet';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
}

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d + '\n');
  })
})
  
req.on('error', error => {
  console.error(error);
})

req.end();
