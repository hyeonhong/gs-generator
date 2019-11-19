
module.exports = async function (messages, workerData, workerPath) {
  const { fork } = require('child_process');

  // Start workers
  for (let i = 0; i < workerData.length; i++) {
    const process = fork(workerPath);
    process.send(workerData[i]);  // send initial message

    // Upon receiving the message from children
    process.on('message', (msg) => {
      messages.push(msg);
      process.send('shutdown');
    });

    process.on('exit', (code, signal) => {
      if (signal) {
        console.log(`worker was killed by signal: ${signal}`);
      } else if (code !== 0) {
        console.log(`worker exited with error code: ${code}`);
      } else {
        console.log('worker terminated successfully!');
      }
    });
  }
}
