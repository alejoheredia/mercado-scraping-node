const puppeteer = require('puppeteer')
const { appendFile } = require('fs/promises')
const {config} = require('./config')

class RetryException extends Error {
  constructor(message) {
    super(message)
    this.name = "RetryException"
  }
}

class MercadoScraper{

  constructor(tienda, fileName, sconfig=config){
    this.tienda = tienda
    this.sconfig = sconfig
    this.fileName = fileName
    this.browser = null
    this.page = null
    this.pageNumber = this.sconfig['start_in_page']
    this.tiendaSelectors = tienda['selectors']
    this.dfIndex = 1
    this.sections = tienda['sections']
    this.sectionsIdx = this.sconfig['start_in_section_index']
    this.fContent = []
    this.retryCounts = 0
  }

  async initBrowser(){
    this.browser = await puppeteer.launch()
    this.page = await this.browser.newPage()
  }

  calcProductQuantity(productPriceLabel, productPriceUnitLabel){
    if(productPriceUnitLabel){
      return [productPriceUnitLabel[0].substring(1), parseFloat(productPriceLabel[1].replace('.', '').replace(',', '.')), parseFloat(productPriceUnitLabel[1].substring(2, productPriceUnitLabel[1].length - 1).replace('.', '').replace(',', '.'))]
    }else{
      return [null, 0, 0]
    }
  }

  elementReturnText(node){
    return node.innerText
  }

  async scrape(){
    
    await appendFile(this.fileName, this.sconfig['file_headers'])
 
    while(true){
      const currentSection = this.sections[this.sectionsIdx]
      
      try{
        await this.page.goto(this.tienda['url'](currentSection, this.pageNumber))
        
        try{
          await new Promise(r => setTimeout(r, this.sconfig['explicit_waits']['initial_load']));
          await this.page.waitForSelector(this.tiendaSelectors['first_element'], {timeout: this.sconfig['explicit_waits']['webdriver_wait']})
          
          console.log(`Page ${this.pageNumber} from section ${currentSection} loaded`)

          const numberOfScrolls = this.sconfig['number_of_scrolls']
          const scrollWait = this.sconfig['explicit_waits']['scroll']
          await this.page.evaluate( async (numberOfScrolls, scrollWait,) => {
            for(let i = 1; i <= numberOfScrolls; i++){
              window.scrollTo(0, document.body.scrollHeight*(i/numberOfScrolls))
              await new Promise(r => setTimeout(r, scrollWait));
            }
          }, numberOfScrolls, scrollWait)
          await new Promise(r => setTimeout(r, this.sconfig['explicit_waits']['items_list_load']));
          await this.page.waitForSelector(this.tiendaSelectors['items_list_container'], {timeout: this.sconfig['explicit_waits']['webdriver_wait']})
        }catch(error){
          console.log(`Could not find the layout of products for page ${this.pageNumber} from section ${currentSection}`)
          console.log("Checking if there are no elements...")

          this.retryCounts += 1
          if(this.retryCounts == this.sconfig['max_retries']){
            if(this.sectionsIdx == this.sections.length-1){
              console.log(`breaking scraper, no more pages. reached page number ${this.pageNumber}`)
              break
            }
            console.log(`finished section ${currentSection}`)
            this.sectionsIdx += 1
            this.pageNumber = 1
            this.retryCounts = 0
            continue
          }else{
            throw new RetryException()
          }
        }

        const productList = await this.page.$(this.tiendaSelectors['items_list_container'])

        if(!productList){
          throw new RetryException()
        }

        console.log(`scraping page ${this.pageNumber} from section ${currentSection}`)
      
        const productListElements = await productList.$$(this.tiendaSelectors['items_list_class'])
        console.log(`Numbers of elements found ${productListElements.length}`)
        for(const productSection of productListElements){
          const productSectionContent = await productSection.$(this.tiendaSelectors['product_section_content'])
          if(!productSectionContent){
            throw new RetryException()
          }

          const productBrandElement = await productSectionContent.$(this.tiendaSelectors['product_brand'])
          const productNameElement = await productSectionContent.$(this.tiendaSelectors['product_name'])
          const productPriceElement = await productSectionContent.$(this.tiendaSelectors['product_price'])
          const productPriceUnitElement = await productSectionContent.$(this.tiendaSelectors['product_price_unit'])

          const productBrand = productBrandElement ? await productBrandElement.evaluate(this.elementReturnText) : null
          const productName = productNameElement ? await productNameElement.evaluate(this.elementReturnText) : null
          const productPrice = productPriceElement ? (await productPriceElement.evaluate(this.elementReturnText)).split('$') : null
          const productPriceUnit = productPriceUnitElement ? (await productPriceUnitElement.evaluate(this.elementReturnText)).split(' a ') : null
          
          const [productUnitLabel, productPriceTotal, productUnitPrice] = this.calcProductQuantity(productPrice, productPriceUnit)
          const productQuantity = productPriceTotal ? Math.round(productPriceTotal/productUnitPrice) : null

          this.fContent.push(`${productBrand},${productName},${productPriceTotal},${productQuantity},${productUnitPrice},${productUnitLabel},${currentSection}\n`)
          console.log(`Scraped ${productName}`)
          this.dfIndex += 1

          //checkpoint to save elements to file
          if(this.dfIndex % this.sconfig['items_checkpoint'] == 0){
            console.log("Checkpoint reached")
            await appendFile(this.fileName, this.fContent.join(''))
            this.fContent = []
          }
        }
        
        this.pageNumber += 1
      }catch(err){
        if(err instanceof RetryException){
          console.log(`Refreshing page ${this.pageNumber} from section ${currentSection}`)
          continue
        }else{
          console.log(err)
          console.log('error but still saving file...')
          await appendFile(this.fileName, this.fContent.join(''))
          continue
        }
      }  
      
    }

    await this.browser.close()
    }

}

exports.MercadoScraper = MercadoScraper