async function main(dummy) {
  let data = [
    [3895, 3535610000, true],  // SPC 1차
    [4063, 4430500000, true],  // SPC 2차
    [4141, 1231130000, false],  // SPC 3차
    [4197, 4337313000, false],  // SPC 4차
    [4266, 1938990000, false]  // SPC 5차
  ];

  // use forks to retrieve data from postgrest
  let result = await getResult(data);
  console.log(result);

}


async function getResult(data) {
  const forkModule = require('../../lib/fork_module.js');

  let messages = [];
  let workerData = ['20181012', '20181011', '20181010'];
  let poolNumber = workerData.length;
  const path = require('path');
  let workerPath = path.join(__dirname, 'worker_code.js');  // location of worker code
  await forkModule(messages, workerData, workerPath);
  require('deasync').loopWhile(function () { return messages.length !== poolNumber; });

  console.log('crazy number: ' + messages.length);
  let result = [];
  messages.map((arr) => { result.push(...arr) });

  return result;
}

module.exports = {
  main
}
