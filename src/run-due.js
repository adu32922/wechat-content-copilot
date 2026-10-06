import { runDueTopics } from './scheduler.js';

const results = await runDueTopics();
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => !item.ok)) process.exitCode = 1;
