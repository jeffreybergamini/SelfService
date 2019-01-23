const puppeteer = require('puppeteer');

async function login(USERNAME, PASSWORD, TERM) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://success.cabrillo.edu');
  await page.waitForSelector('#UserName');
  await page.click('#UserName');
  await page.keyboard.type(USERNAME);
  await page.click('#Password');
  await page.keyboard.type(PASSWORD);
  await page.click('#login-button');
  await page.waitForSelector('#faculty');
  await page.click('#faculty');
  return [browser, page];
}

async function getSectionLinks(TERM, page) {
  await page.waitForSelector(`a[title$="${TERM}"]`);
  const sectionLinks = await page.$$eval(`a[title$="${TERM}"]`,
    links => links.map(link => `https://success.cabrillo.edu${link.getAttribute('href')}`));
  return sectionLinks;
}

async function getSectionStudents(TERM, browser, sectionLink) {
  const page = await browser.newPage();
  await page.goto(sectionLink);
  await page.waitForSelector('#faculty-roster-table > tbody:nth-child(2)');
  const sectionTitle = await page.$eval('#user-profile-name', element => element.textContent);
  const courseID =
    sectionTitle.toLowerCase().split(/\s/)[0].split('-').slice(0, 2).join('') +
    TERM.toLowerCase()[0] + TERM.substring(TERM.length - 2);
  const sectionID = sectionTitle.split(/\s/)[0].split('-').pop().replace(/[^A-Za-z0-9]/g, '');
  
  const studentElements = await page.$$eval('#faculty-roster-table > tbody:nth-child(2) > tr',
    rows => rows.map(
      row => Array.from(row.cells).map(
        cell => cell.textContent.trim())));
  const studentInfo = studentElements.map(cells => {
    const name = cells[0];
    const nameTokens = name.toLowerCase().split(/\s/);
    let username = (nameTokens.slice(0, nameTokens.length - 1).map(token => token[0]).join('') + nameTokens[nameTokens.length - 1]).replace(/[^A-Za-z]/g, '');
    if (username.length > 15)
      username = username.substring(0, 15);
    const studentID = cells[1];
    const email = cells[3]
    return {courseID: courseID, sectionID: sectionID, studentID: studentID, name: name, username: username, email: email};
  });
  
  await page.close();
  return {courseID: courseID, roster: studentInfo};
}

module.exports.getRosters = async function (USERNAME, PASSWORD, TERM) {
  [browser, page] = await login(USERNAME, PASSWORD, TERM);
  sectionLinks = await getSectionLinks(TERM, page);
  const rosters = [];
  for (let i = 0; i < sectionLinks.length; ++i) {
    const roster = await getSectionStudents(TERM, browser, sectionLinks[i]);
    rosters.push(roster);
  }
  await browser.close();
  return rosters;
}
