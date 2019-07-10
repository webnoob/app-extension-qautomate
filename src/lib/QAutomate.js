const path = require('path')
const fs = require('fs-extra')
const paramCase = require('param-case')

module.exports = class QAutomate {
  constructor (api) {
    this._api = api
    this._quasarConfPath = path.join(this._api.appDir, 'quasar.conf.js')
    this._quasarConf = require(this._quasarConfPath)(this._api.ctx)
    this._quasarConfFileData = fs.readFileSync(this._quasarConfPath, 'utf8')
    this._originalQuasarConfFileData = this._quasarConfFileData

    this.reset()
    this.buildWhitelist()
  }

  reset () {
    this._whitelists = {}
    this._analysis = {
      items: {},
      missing: {}
    }
    this.clearLog()
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
   * Receive a list of items for a given group to check and returns a merged list of current and missing items
   * @param group - i.e components, directives, plugins
   * @param quasarConf - The actual conf file
   * @param itemsInUseInSource - The current list of {group} items in use within the source file.
   * @param quasarConfFileData - The string of file data from quasarconf file.
   * @returns {*}
   */
  mergeMissingGroupItems (group, itemsInUseInSource) {
    const missingItems = itemsInUseInSource.filter(e => !this._quasarConf.framework[group].includes(e))

    if (missingItems.length > 0) {
      let currentItems = this.getFrameworkGroup(group, this._quasarConfFileData)

      for (let missingItem of missingItems) {
        if (currentItems.indexOf(missingItem) === -1) {
          currentItems.push(missingItem)
        }
      }
      return currentItems
    }

    return itemsInUseInSource[group]
  }

  /**
   * Convert a list of items back into a format suitable for the quasar.conf.js file.
   * TODO: There has to be a better way of doing this - quasar.conf.js is a function file so have parsed manually.
   * @param group
   * @param data
   * @returns {string}
   */
  stringifyConf (group, items) {
    return JSON.stringify( { [group] : items })
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
   * TODO: There has to be a better way of doing this - quasar.conf.js is a function file so have parsed manually.
   * @param group
   * @param fileData
   * @returns {any}
   */
  getFrameworkGroup (group, fileData) {
    let componentsGroup = fileData.match(this.getGroupRegex(group))[0]
    // Need to wrap it to an object to parse it
    componentsGroup = `{
    ${componentsGroup
      .replace(group, `"${group}"`)
      .replace(/'/g, '"')
      }
  }`

    // Just return the array we want for simplicity.
    return JSON.parse(componentsGroup)[group]
  }

  /**
   * Analyse the source for missing items (items based on the type set in Quasar's api.json files)
   * Eg: Components, Directives and Plugins
   * @param source
   * @returns {{}|*}
   */
  analyse (source) {
    // Loop through our groups we want to check and process them.
    for (let group in this._whitelists) {
      const sourceItems = this.getSourceItems(group, source)

      // Build an array of missing items, grouped by type (i.e component, plugin, directive)
      // without duplicates also taking into account the group might not have been initialised
      // as an array.
      const missingItems = sourceItems.filter(e =>
        !this._quasarConf.framework[group].includes(e) &&
        (
          this._analysis.missing[group] === void 0 ||
          !this._analysis.missing[group].includes(e)
        )
      )

      if (missingItems.length > 0) {
        this._analysis.missing[group] = [].concat.apply([], [this._analysis.missing[group] || [], missingItems])
      }

      const allMergedItems = this.mergeMissingGroupItems(group, sourceItems)
      if (allMergedItems !== void 0 && allMergedItems.length > 0) {
        this._analysis.items[group] = [].concat.apply([], [this._analysis.items[group] || [], allMergedItems.filter(f =>
          !(this._analysis.items[group] || []).includes(f)
        )])
      }
    }
  }

  /**
   * Apply all the analysis results that have been run.
   * @param analysisResult
   * @returns {*}
   */
  applyChanges () {
    for (let groupKey in this._analysis.items) {
      const itemsToReplace = this._analysis.items[groupKey]
      if (itemsToReplace !== void 0) {
        this._quasarConfFileData = this._quasarConfFileData.replace(this.getGroupRegex(groupKey), this.stringifyConf(groupKey, itemsToReplace))
      }
    }

    if (this._quasarConfFileData !== this._originalQuasarConfFileData) {
      this._originalQuasarConfFileData = this._quasarConfFileData
      fs.writeFileSync(this._quasarConfPath, this._quasarConfFileData, 'utf8')
    }
  }

  /**
   * this.analyse() the source and then this.applyChanges()
   * @param source
   * @returns {*}
   */
  analyseAndApply (source) {
    this.analyse(source)
    return this.applyChanges()
  }

  getMissingItems () {
    return this._analysis.missing
  }

  addLog (msg) {
    this._logs.push(msg)
  }

  clearLog () {
    this._logs = []
  }

  writeLog () {
    for (let log of this._logs) {
      console.log(log)
    }
  }
}
