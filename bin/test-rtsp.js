const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * Test RTSP connection with various options
 * Usage: node test-rtsp.js <username> <password> <ip> <port> <path>
 * Example: node test-rtsp.js admin password123 192.168.1.100 554 /stream1
 */

const args = process.argv.slice(2);

if (args.length < 5) {
  console.log('Usage: node test-rtsp.js <username> <password> <ip> <port> <path>');
  console.log('Example: node test-rtsp.js Test123 Test123456 192.168.1.26 554 /stream1');
  process.exit(1);
}

const [username, password, ip, port, streamPath] = args;
const rtspUrl = `rtsp://${username}:${password}@${ip}:${port}${streamPath}`;

console.log('========================================');
console.log('RTSP Connection Test Tool');
console.log('========================================');
console.log(`IP: ${ip}`);
console.log(`Port: ${port}`);
console.log(`Path: ${streamPath}`);
console.log(`Username: ${username}`);
console.log(`URL: rtsp://${username}:***@${ip}:${port}${streamPath}`);
console.log('========================================\n');

const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const testConfigs = [
  {
    name: 'TCP Transport (Recommended)',
    options: [
      '-rtsp_transport', 'tcp',
      '-analyzeduration', '5000000',
      '-probesize', '5000000'
    ]
  },
  {
    name: 'UDP Transport',
    options: [
      '-rtsp_transport', 'udp',
      '-analyzeduration', '5000000',
      '-probesize', '5000000'
    ]
  },
  {
    name: 'HTTP Tunnel',
    options: [
      '-rtsp_transport', 'http',
      '-analyzeduration', '5000000',
      '-probesize', '5000000'
    ]
  },
  {
    name: 'Minimal Options',
    options: [
      '-rtsp_transport', 'tcp'
    ]
  }
];

async function testConnection(config, index) {
  return new Promise((resolve) => {
    console.log(`\n[Test ${index + 1}/${testConfigs.length}] ${config.name}`);
    console.log(`Options: ${config.options.join(' ')}`);
    
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `test_frame_${timestamp}.jpg`);
    
    const timeout = setTimeout(() => {
      console.log(`❌ TIMEOUT (15 seconds)`);
      resolve(false);
    }, 15000);
    
    ffmpeg(rtspUrl)
      .inputOptions(config.options)
      .outputOptions([
        '-vframes', '1',
        '-q:v', '2',
          '-update', '1',
        '-f', 'image2'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log(`Command: ${commandLine.substring(0, 150)}...`);
      })
      .on('stderr', (line) => {
        // Only show important lines
        if (line.includes('Stream #') || line.includes('Video:') || 
            line.includes('error') || line.includes('Error')) {
          console.log(`  ${line}`);
        }
      })
      .on('end', () => {
        clearTimeout(timeout);
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            console.log(`✅ SUCCESS - Frame captured (${stats.size} bytes)`);
            console.log(`   Saved to: ${outputPath}`);
            resolve(true);
          } else {
            console.log(`❌ FAILED - File is empty`);
            fs.unlinkSync(outputPath);
            resolve(false);
          }
        } else {
          console.log(`❌ FAILED - File not created`);
          resolve(false);
        }
      })
      .on('error', (err, stdout, stderr) => {
        clearTimeout(timeout);
        console.log(`❌ FAILED - ${err.message}`);
        if (stderr && stderr.length < 500) {
          console.log(`   Error details: ${stderr}`);
        }
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        resolve(false);
      })
      .run();
  });
}

async function runAllTests() {
  console.log('Starting RTSP connection tests...\n');
  
  let successCount = 0;
  
  for (let i = 0; i < testConfigs.length; i++) {
    const success = await testConnection(testConfigs[i], i);
    if (success) successCount++;
    
    // Wait a bit between tests
    if (i < testConfigs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n========================================');
  console.log('Test Results Summary');
  console.log('========================================');
  console.log(`Successful: ${successCount}/${testConfigs.length}`);
  console.log(`Failed: ${testConfigs.length - successCount}/${testConfigs.length}`);
  
  if (successCount > 0) {
    console.log('\n✅ At least one configuration works!');
    console.log('The application should be able to connect to your camera.');
  } else {
    console.log('\n❌ No configuration worked.');
    console.log('\nTroubleshooting suggestions:');
    console.log('  1. Verify the RTSP URL works in VLC Media Player');
    console.log('  2. Check if the camera is accessible: ping ' + ip);
    console.log('  3. Verify RTSP is enabled in camera settings');
    console.log('  4. Try different stream paths:');
    console.log('     - /stream1, /stream2');
    console.log('     - /live, /live0, /live1');
    console.log('     - /h264, /h265');
    console.log('     - /Streaming/Channels/101');
    console.log('  5. Check firewall settings (port ' + port + ')');
    console.log('  6. Update camera firmware');
  }
  
  console.log('\n');
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
