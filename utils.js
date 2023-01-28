const {existsSync} = require('fs')
const {writeFile} = require('fs/promises')
const path = require('path')

exports.createFile = async (pathOutput, filename=null) => {
  let fName = filename.endsWith('.csv') ? filename : `${filename}.csv`

  if(existsSync(fName)){
    throw new Error('File already exists')
  }

  const dateNow = new Date()

  fName = `output_${('0' + (dateNow.getMonth() + 1)).slice(-2)}-${dateNow.getDate()}-${dateNow.getFullYear()}T${dateNow.getHours()}_${dateNow.getMinutes()}_${dateNow.getSeconds()}.csv`

  const fPath = path.join(pathOutput, fName)
  await writeFile(fPath, '')
  return fPath
}

exports.argsParser = (args, legalArgs) => {
  const validArgs = legalArgs.reduce((acc, cur) => ([...acc, ...cur['valid']]), [])

  const parsedArgs = {}
  for(arg of args){
    const [k, v] = arg.split('=')
    if(!validArgs.includes(k)){
      throw new Error(`Invalid argument ${argsKey}`)
    }

    parsedArgs[[k.replaceAll('-', '')]] = v
  }

  for(const argsKey in parsedArgs){

    const config = legalArgs.filter(arg => arg.name === argsKey).pop()

    if(config.choices && !config.choices.includes(parsedArgs[argsKey])){
      throw new Error(`Invalid option for argument ${argsKey}. Choose from ${config.choices}`)
    }

    if(config.required && !parsedArgs[argsKey]){
      throw new Error(`Argument ${argsKey} missing value`)
    }

    parsedArgs[argsKey] = parsedArgs[argsKey] || config.default

  }

  return parsedArgs
}