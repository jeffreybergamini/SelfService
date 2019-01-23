const selfService = require('./selfservice');

async function printRosters() {
  const rosters = await selfService.getRosters('employee_id', 'password', 'Spring 2019');
  console.log(rosters);
}

printRosters();
