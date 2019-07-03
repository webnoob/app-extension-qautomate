const path = require('path')
const fs = require('fs-extra')
const paramCase = require('param-case')

module.exports = class QAutomate {
  constructor (api) {
    this._api = api
    this._whitelists = {}
    this.buildWhitelist()
  }

  /**
   * Find the quasar package installed and build an allowed list of tags we can look for based on the API.json files.
   */
  buildWhitelist () {
    const quasarUiPath = this._api.resolve.app(path.join('node_modules', 'quasar', 'dist', 'api'))
    let files = fs.readdirSync(quasarUiPath)

    for (let file of files) {
      const
        data = require(path.join(quasarUiPath, file)),
        type = `${data.type}s` // Just so it matches our groups we're using (based on quasar.conf.js->framework.

      if (!Array.isArray(this._whitelists[type])) {
        this._whitelists[type] = []
      }

      this._whitelists[type].push({
        name: path.basename(file, path.extname(file)),
        injectionMethod: data.injection || ''
      })
    }
  }

  /**
   * Scan the source template and get all the Quasar items
   * NOTE: This is currently HTML only and won't support PUG.
   * @param group
   * @param source
   * @returns {string[]}
   */
  getSourceItems (group, source) {
    const result = []
    for (let wlItem of this._whitelists[group]) {
      const sourceComponent = paramCase(wlItem.name)
      if (
        // Normal component / directive etc.
        source.indexOf(sourceComponent) > -1 ||
        (
          // Something like a plugin (not testing for plugin so it's more future proof)
          wlItem.injectionMethod.indexOf('$q.') > -1 &&
          (
            source.indexOf(wlItem.name) > -1 ||
            source.indexOf(`$q.${wlItem.name.toLowerCase()}`) > -1
          )
        )
      ) {
        result.push(wlItem.name)
      }
    }
    return result
  }

  /**
   * Receive a list of items for a given group to check and return a list of items that need to be added.
   * @param group - i.e components, directives, plugins
   * @param quasarConf - The actual conf file
   * @param itemsInUseInSource - The current list of {group} items in use within the source file.
   * @param quasarConfFileData - The string of file data from quasarconf file.
   * @returns {*}
   */
  getMissingGroupItems (group, quasarConf, itemsInUseInSource, quasarConfFileData) {
    const missingItems = itemsInUseInSource.filter(e => !quasarConf.framework[group].includes(e))
    if (missingItems.length > 0) {
      let currentItems = this.getFrameworkGroup(group, quasarConfFileData)

      for (let missingItem of missingItems) {
        if (currentItems[group].indexOf(missingItem) === -1) {
          console.log(` App Extension (qautomate) Info: Adding missing [${group}] to quasar.conf.js [${missingItem}]`)
          currentItems[group].push(missingItem)
        }
      }
      return currentItems
    }

    return itemsInUseInSource
  }

  /**
   * Convert a list of items back into a format suitable for the quasar.conf.js file.
   * @param group
   * @param data
   * @returns {string}
   */
  stringifyConf (group, data) {
    return JSON.stringify(data)
      .replace('{', '')
      .replace('}', '')
      .replace(`"${group}":[`, `${group}: [\n`)
      .replace(/\",/g, `',`)
      .replace(/\"]/g, `']`)
      .replace(/\"/g, `        '`)
      .replace(/,/g, `,\n`)
      .replace(`']`, `'\n      ]`)
  }

  /**
   * Regex to get a groups list of items.
   * @param group
   * @returns {RegExp}
   */
  getGroupRegex (group) {
    return new RegExp(group + `:[\\s\\[\\]a-zA-Z',]*\\]`, 'g')
  }

  /**
   * Get a group section i.e `components: [ 'QInput' ]` from
   * the quasar.conf.js file and return the array for processing.
   * @param group
   * @param fileData
   * @returns {any}
   */
  getFrameworkGroup (group, fileData) {
    let componentsGroup = fileData.match(this.getGroupRegex(group))[0]
    componentsGroup = `{
    ${componentsGroup
      .replace(group, `"${group}"`)
      .replace(/'/g, '"')
      }
  }`

    return JSON.parse(componentsGroup)
  }

  /**
   * Find any components, directives or plugins in use in the source code that aren't contained
   * in the quasar.conf.js file and add them in.
   * @param source
   * @param api
   * @returns {*}
   */
  run (source) {
    const
      quasarConfPath = path.join(this._api.appDir, 'quasar.conf.js'),
      quasarConf = require(quasarConfPath)(this._api.ctx),
      quasarConfFileData = fs.readFileSync(quasarConfPath, 'utf8')

    fs.appendFileSync(path.join(this._api.appDir, 'debug.txt'), source, 'utf8')
    let newData = quasarConfFileData

    // Loop through our groups we want to check and process them.
    for (let groupKey in this._whitelists) {
      const sourceItems = this.getSourceItems(groupKey, source)
      let newGroupItemList = this.getMissingGroupItems(groupKey, quasarConf, sourceItems, newData)

      if (newGroupItemList.length !== sourceItems.length) {
        newData = newData.replace(this.getGroupRegex(groupKey), this.stringifyConf(groupKey, newGroupItemList))
      }
    }

    if (newData !== quasarConfFileData) {
      fs.writeFileSync(quasarConfPath, newData, 'utf8')
    }

    return source
  }
}
