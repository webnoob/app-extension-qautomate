/**
 * Quasar App Extension index/runner script
 * (runs on each dev/build)
 *
 * API: https://github.com/quasarframework/quasar/blob/master/app/lib/app-extension/IndexAPI.js
 */

const QAutomate = require('./lib/QAutomate')
let qAutomate = null

/**
 * Setup a loader that will allow us to hook into file changes and get the source code.
 * @param api
 * @param chain
 * @param isClient
 */
const chainWebpack = function (api, chain, { isClient }) {
  console.log(` App Extension (qautomate) Info: Hooking up loader for file component checks.`)
  const rule = chain.module.rule('qautomate-vue')
    .test(/\.(js|vue)$/)
    .exclude
      .add(/node_modules/)
      .end()

  rule.use('ware-loader')
    .loader('ware-loader')
    .options({
      raw: true,
      middleware: src => qAutomate.run(src)
    })
}

module.exports = function (api) {
  qAutomate = new QAutomate(api)
  api.chainWebpack((chain, { isClient }) => chainWebpack(api, chain, isClient))
}
