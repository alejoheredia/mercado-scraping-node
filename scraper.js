const puppeteer = require('puppeteer');
const { appendFile } = require('fs/promises');
const {config} = require('./config');

async function scraper (tienda, outputFile) {
  const pageNumber = config['start_in_page']
  const tiendaSelectors = tienda['selectors']
  const dfIndex = 1
  const sections = tienda['sections']
  const sectionsIdx = config['start_in_section_index']
  await appendFile(outputFile, config['file_headers'])
  const fContent = []

  const retryCounts = 0

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  while(true){
    const currentSection = sections[sectionsIdx]

    await page.goto(tienda['url'](currentSection, pageNumber))
  
    await page.waitForSelector(tiendaSelectors['first_element'])

    console.log(`Page ${pageNumber} from section ${currentSection} loaded`)

    const numberOfScrolls = config['number_of_scrolls']
    for(let i = 1; i <= numberOfScrolls; i++){
      await page.evaluate( (numberOfScrolls, i) => window.scrollTo(0, document.body.scrollHeight*(i/numberOfScrolls)))
      await new Promise(r => setTimeout(r, config['explicit_waits']['scroll']));
    }

    await new Promise(r => setTimeout(r, config['explicit_waits']['items_list_load']));

    const product_list = await page.waitForSelector(tiendaSelectors['items_list_container']) 
    console.log(product_list)
    break
  }

  await browser.close();
}

(async () => {
  scraper(config['tiendas']['exito'], './aaa')
})()