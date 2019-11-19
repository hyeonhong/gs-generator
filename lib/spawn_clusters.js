
module.exports = async function (messages, workerData, workerPath) {
  const cluster = require('cluster');

  // Go through all workers
  let eachWorker = function (callback) {
    for (const id in cluster.workers) {
      callback(cluster.workers[id]);
    }
  }

  if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Start workers
    for (let i = 0; i < workerData.length; i++) {
      const w = cluster.fork();
      w.send(workerData[i]);  // send initial message
    }

    // // Send message to workers
    // eachWorker((worker) => {
    //   worker.send('some message');
    // });

    // Upon receiving the message from workers
    eachWorker((worker) => {
      worker.on('message', (msg) => {
        // console.log(msg);
        messages.push(msg);
        worker.send('shutdown');
      });
    });

    eachWorker((worker) => {
      worker.on('exit', (code, signal) => {
        if (signal) {
          console.log(`worker was killed by signal: ${signal}`);
        } else if (code !== 0) {
          console.log(`worker exited with error code: ${code}`);
        } else {
          console.log('worker terminated successfully!');
        }
      });
    });

  } else {
    console.log(`Worker ${process.pid} is running`);

    // Upon receiving the message from master
    process.on('message', async (msg) => {
      if (msg === 'shutdown') {
        process.exit();
      } else {
        const runWorkerCode = require(workerPath);
        let result = await runWorkerCode(msg);

        // send result to master process
        process.send(result);
      }
    });
  }
}
