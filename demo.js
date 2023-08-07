const selfService = require('./selfservice');

async function printRosters() {
  const rosters = await selfService.getRosters('employee_id', 'password', '2023FA', 'Fall 2023');
  console.log(rosters);
}

printRosters();
