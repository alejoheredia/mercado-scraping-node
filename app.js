const {config} = require('./config')
const path = require('path')
const {existsSync} = require('fs')
const {mkdir} = require('fs/promises')
const {createFile, argsParser} = require('./utils');

(async () => {
  const args = process.argv.splice(2)
  const legalArgs = [{name: 'tienda', valid:['-t', '--tienda'], choices: ['exito', 'jumbo', 'carulla'], default: 'exito', required: true}, {name: 'file', valid:['-f', '--file'], default: null, required: false}]

  const parsedArgs = argsParser(args, legalArgs)

  const scraperConfig = config['tiendas'][parsedArgs.tienda]
  if(!scraperConfig){
    throw new Error(`La configuración para la tienda ${parsedArgs.tienda} no existe`)
  }

  const defaultOutputPath = path.join(__dirname, 'output', parsedArgs.tienda)

  if(!existsSync(defaultOutputPath)){
    console.log(`Creating dir ${defaultOutputPath}`)
    await mkdir(defaultOutputPath, {recursive: true})
  }

  const fileName = await createFile(defaultOutputPath, parsedArgs.tienda)

})()
