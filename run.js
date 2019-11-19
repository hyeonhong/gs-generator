process.env.GS_ENV = 'local';
let projectName = process.argv[2];
const { main } = require(`./projects/${projectName}.js`);
global.rootDir = __dirname;
let result = main();
console.log(result);
