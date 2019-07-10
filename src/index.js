/**
 * Quasar App Extension index/runner script
 * (runs on each dev/build)
 *
 * API: https://github.com/quasarframework/quasar/blob/master/app/lib/app-extension/IndexAPI.js
 */

const QAutomate = require('./lib/QAutomate')
const chalk = require('chalk')
const inquirer = require('inquirer')
let qAutomate = null

class QAutomatePlugin {
  constructor (api) {
    this.quasarConfFixMode = api.prompts.quasarConfFixMode
  }

  apply(compiler) {
    compiler.hooks.done.tap('done-compiling', () => {
      switch (this.quasarConfFixMode) {
        case 'automatic':
          // Needs a rework to get this working as the quasar.conf.js save on auto triggers a complete reload
          // and we lose the stored value in our qAutomate class.
          printSummary('bgGreen', 'Automatically added the following:')
          qAutomate.applyChanges()
          break
        case 'warn':
          printSummary('bgRed', 'Found missing items')
          break
        case 'manual':
          presentManualOptions()
          break

      }

      // Write the buffer to console (gets cleared on HMR so handled internally)
      qAutomate.writeLog()
      // Reset the qAutomate instance for the next scan.
      qAutomate.reset()
    })
  }
}

const presentManualOptions = () => {

  const missingItems = qAutomate.getMissingItems()
  let choices = []

  for (let group in missingItems) {
    choices.push(new inquirer.Separator(chalk`{green ${group} }`))


    for (let item of missingItems[group]) {
      choices.push({
        name: item
      })
    }
  }

  inquirer.prompt([
    {
      type: 'checkbox',
      message: chalk`{bgGreen Select items to add to quasar.conf.js}`,
      name: 'items',
      choices: choices
    }
  ]).then(answers => {
    console.log(answers.items)
    qAutomate.applyChanges(answers.items)
  })
}

const printSummary = (colorStyle, msg) => {
  const missingItems = qAutomate.getMissingItems()
  if (Object.keys(missingItems).length > 0) {
    qAutomate.addLog(chalk`{bold {${colorStyle}  App Extension (qautomate) Info: ${msg}}}`)
  }

  for (let group in missingItems) {
    qAutomate.addLog(chalk`
  {bold {green ${group}}}`
    )

    for (let item of missingItems[group]) {
      qAutomate.addLog(`    ${item}`)
    }
  }

  qAutomate.addLog(`
  `)
}

const handlePromptType = (src, prompts) => {
  switch (prompts.quasarConfFixMode) {
    case 'automatic':
    case 'manual':
    default:
      qAutomate.analyse(src)
      return src
  }
}

/**
 * Setup a loader that will allow us to hook into file changes and get the source code.
 * @param api
 * @param chain
 * @param isClient
 */
const chainWebpack = function (api, chain, { isClient }) {
  console.log(chalk` {green app:extension} Extension(qautomate): Hooking up loader for file component checks.`)
  const rule = chain.module.rule('qautomate-vue')
    .test(/\.(js|vue)$/)
    .exclude
      .add(/node_modules/)
      .end()

  rule.use('ware-loader')
    .loader('ware-loader')
    .options({
      raw: true,
      middleware: src => handlePromptType(src, api.prompts)
    })
}

module.exports = function (api) {
  qAutomate = new QAutomate(api)
  api.chainWebpack((chain, { isClient }) => chainWebpack(api, chain, isClient))

  // Register a plugin with a hook for logging etc.
  api.extendWebpack((cfg, { isClient, isServer }, api) => {
    cfg.plugins.push(new QAutomatePlugin(api))
  })
}
