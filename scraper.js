const puppeteer = require('puppeteer')
const { appendFile } = require('fs/promises')
const {config} = require('./config')

class RetryException extends Error {
  constructor(message) {
    super(message)
    this.name = "RetryException"
  }
}

function calcProductQuantity(productPriceLabel, productPriceUnitLabel){
  if(productPriceUnitLabel){
    return [productPriceUnitLabel[0].substring(1), parseFloat(productPriceLabel[1].replace('.', '').replace(',', '.')), parseFloat(productPriceUnitLabel[1].substring(2, productPriceUnitLabel[1].length - 1).replace('.', '').replace(',', '.'))]
  }else{
    return [null, 0, 0]
  }
}

async function scraper (tienda, outputFile) {
  let pageNumber = 2//config['start_in_page']
  const tiendaSelectors = tienda['selectors']
  let dfIndex = 1
  const sections = tienda['sections']
  let sectionsIdx = config['start_in_section_index']
  await appendFile(outputFile, config['file_headers'])
  let fContent = []

  let retryCounts = 0

  //const browser = await puppeteer.launch({devtools: true, headless: false})
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  
  await page.exposeFunction('waitForScroll', async (miliseconds) => {
    await page.waitForNetworkIdle(miliseconds)
  });

  while(true){
    const currentSection = sections[sectionsIdx]
    
    try{
      await page.goto(tienda['url'](currentSection, pageNumber))
      
      try{
        await new Promise(r => setTimeout(r, config['explicit_waits']['initial_load']));
        await page.waitForSelector(tiendaSelectors['first_element'], {timeout: config['explicit_waits']['webdriver_wait']})
        
        console.log(`Page ${pageNumber} from section ${currentSection} loaded`)

        const numberOfScrolls = config['number_of_scrolls']
        const scrollWait = config['explicit_waits']['scroll']
        await page.evaluate( async (numberOfScrolls, scrollWait,) => {
          for(let i = 1; i <= numberOfScrolls; i++){
            window.scrollTo(0, document.body.scrollHeight*(i/numberOfScrolls))
            await new Promise(r => setTimeout(r, 800));
          }
        }, numberOfScrolls, scrollWait)
        await new Promise(r => setTimeout(r, config['explicit_waits']['items_list_load']));
        await page.waitForSelector(tiendaSelectors['items_list_container'], {timeout: config['explicit_waits']['webdriver_wait']})
      }catch(error){
        console.log(`Could not find the layout of products for page ${pageNumber} from section ${currentSection}`)
        console.log("Checking if there are no elements...")

        retryCounts += 1
        if(retryCounts == config['max_retries']){
          if(sectionsIdx == sections.length-1){
            console.log(`breaking scraper, no more pages. reached page number ${pageNumber}`)
            break
          }
          console.log(`finished section ${currentSection}`)
          sectionsIdx += 1
          pageNumber = 1
          retryCounts = 0
          continue
        }else{
          throw new RetryException()
        }
      }

      const productList = await page.$(tiendaSelectors['items_list_container'])

      if(!productList){
        throw new RetryException()
      }

      console.log(`scraping page ${pageNumber} from section ${currentSection}`)
    
      const productListElements = await productList.$$(tiendaSelectors['items_list_class'])
      console.log(`Numbers of elements found ${productListElements.length}`)
      for(const productSection of productListElements){
        const productSectionContent = await productSection.$(tiendaSelectors['product_section_content'])
        if(!productSectionContent){
          throw new RetryException()
        }

        const productBrand = await (await productSectionContent.$(tiendaSelectors['product_brand'])).evaluate( node => node.innerText)
        const productName = await (await productSectionContent.$(tiendaSelectors['product_name'])).evaluate( node => node.innerText)
        const productPrice = (await (await productSectionContent.$(tiendaSelectors['product_price'])).evaluate( node => node.innerText)).split('$')
        const productPriceUnit = (await (await productSectionContent.$(tiendaSelectors['product_price_unit'])).evaluate( node => node.innerText)).split(' a ')
        
        const [productUnitLabel, productPriceTotal, productUnitPrice] = calcProductQuantity(productPrice, productPriceUnit)
        const productQuantity = productPriceTotal ? Math.round(productPriceTotal/productUnitPrice) : null

        fContent.push(`${productBrand},${productName},${productPriceTotal},${productQuantity},${productUnitPrice},${productUnitLabel},${currentSection}\n`)
        console.log(`Scraped ${productName}`)
        dfIndex += 1

        //checkpoint to save elements to file
        if(dfIndex % config['items_checkpoint'] == 0){
          console.log("Checkpoint reached")
          await appendFile(outputFile, fContent.join(''))
          fContent = []
        }
      }
      
      pageNumber += 1
    }catch(err){
      if(err instanceof RetryException){
        console.log(`Refreshing page ${pageNumber} from section ${currentSection}`)
        continue
      }else{
        console.log(err)
        console.log('error but still saving file...')
        await appendFile(outputFile, fContent.join(''))
        continue
      }
    }  
      
  }

  await browser.close()
}

(async () => {
  scraper(config['tiendas']['exito'], './aaa')
})()