const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function login(USERNAME, PASSWORD, TERM_SHORT) {
  const browser = await puppeteer.launch({
    /*
    headless: false,
    slowMo: 100, // slow down by 10000ms
    args: [
      '--disable-gpu'
    ]
    */
  });

  const page = await browser.newPage();

  const cookiesString = await fs.readFile('./success.cabrillo.edu.cookies.json');
  const cookies = JSON.parse(cookiesString);
  await page.setCookie(...cookies);

  await page.goto('https://success.cabrillo.edu/Student/');
  /*
  await page.waitForSelector('#userNameInput', {visible: true});
  await page.click('#userNameInput');
  await page.keyboard.type(USERNAME);
  await page.click('#passwordInput');
  await page.keyboard.type(PASSWORD);
  await page.click('#submitButton');
  */
  await page.waitForSelector('#faculty', {visible: true});
  await page.click('#faculty');
  await page.goto('https://success.cabrillo.edu/Student/Student/Faculty');
  await page.waitForSelector(`#faculty-sections-${TERM_SHORT}`, {visible: true});
  return [browser, page];
}

async function getSectionLinks(TERM_SHORT, TERM_LONG, page) {
  await page.waitForSelector(`#faculty-sections-${TERM_SHORT}`, {visible: true});
  const sectionLinks = await page.$$eval(`a[title$="${TERM_LONG} "]`,
    links => links.map(link => `https://success.cabrillo.edu${link.getAttribute('href')}`));
  return sectionLinks;
}

async function getSectionStudents(TERM_LONG, browser, sectionLink) {
  const page = await browser.newPage();
  await page.goto(sectionLink);
  await page.waitForSelector('#faculty-roster-table > tbody:nth-child(2)', {visible: true});
  const sectionTitle = await page.$eval('#user-profile-name', element => element.textContent);
  const courseID =
    sectionTitle.toLowerCase().split(/\s/)[0].split('-').slice(0, 2).join('') +
    TERM_LONG.toLowerCase()[0] + TERM_LONG.substring(TERM_LONG.length - 2);
  const sectionID = sectionTitle.split(/\s/)[0].split('-').pop().replace(/[^A-Za-z0-9]/g, '');
  
  let studentInfo = [];

  const sectionInfo = [
    {tableId: '#faculty-roster-table', preClick: undefined},
    {tableId: '#faculty-waitlist-table', preClick: '#waitlistsTab > a:nth-child(1)'}
  ];

  for (let i = 0; i < sectionInfo.length; ++i) {
    const info = sectionInfo[i];
    if (info.preClick !== undefined) {
      await page.click(info.preClick);
    }
    try {
      await page.waitForSelector(`${info.tableId}`);
    } catch (e) {
      continue;
    }
    const studentElements = await page.$$eval(`${info.tableId} > tbody:nth-child(2) > tr`,
      rows => rows.map(
        row => Array.from(row.cells).map(
          cell => cell.textContent.trim())));
    const thisInfo = studentElements.map(cells => {
      let name = cells[0].trim();
      let nameTokens;
      if (name.indexOf('(Dropped') >= 0)
        return undefined;
      if (name.indexOf('\n') > 0) {
        const nameComponents = name.split('\n').map(s => s.trim()).filter(s => s);
        name = nameComponents[0].trim();
        nameTokens = name.toLowerCase().split(/\s/);
        const pronouns = nameComponents[1];
        if (pronouns.indexOf('/') >= 0)
          name = `${name} (${pronouns})`;
      } else {
        nameTokens = name.toLowerCase().split(/\s/);
      }
      let username = (nameTokens.slice(0, nameTokens.length - 1).map(token => token[0]).join('') + nameTokens[nameTokens.length - 1]).replace(/[^A-Za-z]/g, '');
      if (username.length > 15)
        username = username.substring(0, 15);
      const studentID = cells[1];
      let email = cells[4];
      if (email.indexOf('@') == -1)
        email = cells[6];
      return {courseID: courseID, sectionID: sectionID, studentID: studentID, name: name, username: username, email: email};
    }).filter(o => o);
    studentInfo = studentInfo.concat(thisInfo);
  }

  await page.close();
  return {courseID: courseID, roster: studentInfo};
}

async function getSectionAddCodes(TERM_LONG, browser, sectionLink) {
  const page = await browser.newPage();
  await page.goto(sectionLink);
  await page.waitForSelector('#faculty-roster-table > tbody:nth-child(2)', {visible: true});
  const sectionTitle = await page.$eval('#user-profile-name', element => element.textContent);
  const courseID =
    sectionTitle.toLowerCase().split(/\s/)[0].split('-').slice(0, 2).join('') +
    TERM_LONG.toLowerCase()[0] + TERM_LONG.substring(TERM_LONG.length - 2);
  const sectionID = sectionTitle.split(/\s/)[0].split('-').pop().replace(/[^A-Za-z0-9]/g, '');
  await page.waitForSelector('#permissionsTab > a', {visible: true});
  await page.click('#permissionsTab > a');
  await page.waitForSelector('#faculty-permissions-nav > div.clear-group > div > div:nth-child(4) > a', {visible: true});
  await page.click('#faculty-permissions-nav > div.clear-group > div > div:nth-child(4) > a');
  await page.waitForSelector('#authorization-29-code', {visible: true}); // Hacky, but whatever
  const addCodes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('td'))
      .filter(cell => cell.getAttribute('data-role') === 'Authorization Code')
      .map(cell => cell.textContent.trim())
  );
  await page.close();
  return {courseID: courseID, sectionID: sectionID, addCodes: addCodes};
}

module.exports.getRosters = async function (USERNAME, PASSWORD, TERM_SHORT, TERM_LONG) {
  [browser, page] = await login(USERNAME, PASSWORD, TERM_SHORT);
  sectionLinks = await getSectionLinks(TERM_SHORT, TERM_LONG, page);
  const rosters = [];
  for (let i = 0; i < sectionLinks.length; ++i) {
    const roster = await getSectionStudents(TERM_LONG, browser, sectionLinks[i]);
    rosters.push(roster);
  }
  await browser.close();
  return rosters;
}

module.exports.getAddCodes = async function (USERNAME, PASSWORD, TERM_SHORT, TERM_LONG) {
  [browser, page] = await login(USERNAME, PASSWORD, TERM_SHORT);
  sectionLinks = await getSectionLinks(TERM_SHORT, TERM_LONG, page);
  const allAddCodes = [];
  for (let i = 0; i < sectionLinks.length; ++i) {
    const addCodes = await getSectionAddCodes(TERM_SHORT, browser, sectionLinks[i]);
    allAddCodes.push(addCodes);
  }
  await browser.close();
  return allAddCodes;
}
