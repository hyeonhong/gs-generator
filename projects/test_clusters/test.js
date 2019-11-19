
// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

async function main(dummy) {
  let data = [
    [3895, 3535610000, true],  // SPC 1차
    [4063, 4430500000, true],  // SPC 2차
    [4141, 1231130000, false],  // SPC 3차
    [4197, 4337313000, false],  // SPC 4차
    [4266, 1938990000, false]  // SPC 5차
  ];

  // use clusters to retrieve data from postgrest
  let result = await getResult(data);
  console.log(result);

}


async function getResult(data) {
  const spawnClusters = require('../../lib/spawn_clusters.js');

  let messages = [];
  let workerData = ['20181012', '20181011', '20181010'];
  let poolNumber = workerData.length;
  const path = require('path');
  let workerPath = path.join(__dirname, 'worker_code.js');  // location of worker code
  await spawnClusters(messages, workerData, workerPath);
  require('deasync').loopWhile(function () { return messages.length !== poolNumber; });

  console.log('crazy number: ' + messages.length);
  let result = [];
  messages.map((arr) => { result.push(...arr) });

  return result;
}

module.exports = {
  main
}
