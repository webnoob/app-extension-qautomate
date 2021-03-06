const path = require('path')
const fs = require('fs-extra')
const paramCase = require('param-case')

module.exports = class QAutomate {
  
  constructor (api, options) {
    this._api = api
    this._quasarConfPath = path.join(this._api.appDir, 'quasar.conf.js')
    this._quasarConf = require(this._quasarConfPath)(this._api.ctx)
    this._quasarConfFileData = fs.readFileSync(this._quasarConfPath, 'utf8')
    this._originalQuasarConfFileData = this._quasarConfFileData
    this._options = options
    this._forceApplyChanges = false
    this._whitelists = {}
  
    this.reset()
    this.buildWhitelist()
  }

  reset () {
    this._analysis = {
      existing: {},
      missing: {},
      merged: {}
    }
    this.clearLog()
    
    // If we're requiring changes to be saved, make sure they are before the reset happens.
    if (this._forceApplyChanges) {
      this.applyChanges()
    }
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
   * @param group - The type we're looking for i.e Components, Directives or Plugins.
   * @param source - HTML / PUG / Text to scan
   * @returns {string[]}
   */
  scanForSourceItems (group, source) {
    const result = []
    for (let wlItem of this._whitelists[group]) {
      const sourceItem = paramCase(wlItem.name)
      const itemSearchVariations = [
        `${sourceItem}>`,
        `${sourceItem} `,
        `${sourceItem}.`,
        `${sourceItem}=`
      ]
      
      if (
        // Normal component / directive etc.
        itemSearchVariations.some(s => source.indexOf(s) > -1) ||
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
   * Convert a list of items back into a format suitable for the quasar.conf.js file.
   * TODO: There has to be a better way of doing this - quasar.conf.js is a function file so have parsed manually.
   * @param group
   * @param data
   * @returns {string}
   */
  stringifyConfGroup (group, items) {
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
   * Analyse the source for missing items (items based on the type set in Quasar's api.json files)
   * Eg: Components, Directives and Plugins
   * @param source
   * @returns {{}|*}
   */
  analyse (source) {
    // Loop through our groups we want to check and process them.
    for (let group in this._whitelists) {
      const sourceItems = this.scanForSourceItems(group, source)

      // Build an array of missing items, grouped by type (i.e component, plugin, directive)
      // without duplicates also taking into account the group might not have been initialised
      // as an array.
      const missingItems = sourceItems.filter(e =>
        !this._quasarConf.framework[group].includes(e) &&
        !(this._analysis.missing[group] || []).includes(e)
      )

      if (missingItems.length > 0) {
        this._analysis.missing[group] = this.mergeArrays(this._analysis.missing[group], missingItems)
      }
  
      this._analysis.existing[group] = this._quasarConf.framework[group]
      this._analysis.merged[group] = this.mergeArrays(this._analysis.existing[group], this._analysis.missing[group])
      
      // If sorting is enabled, check to see if we need to apply sorting.
      // Then flag to force a save if reset is called before applyChanges()
      if (this._options.sort) {
        this._analysis.merged[group].sort()
        // Using stringify here as as I know the data will always be an array.
        if (JSON.stringify(this._analysis.existing[group]) !== JSON.stringify(this._analysis.merged[group])) {
          this._forceApplyChanges = true
        }
      }
    }
  }

  /**
   * Apply all the analysis results that have been run.
   * @param analysisResult
   * @returns {*}
   */
  applyChanges (selectedItems = []) {
    for (let group in this._analysis.merged) {
      // Pick out only the selected items for this group or add them all based on selectedItems
      let itemsToReplace = selectedItems.length > 0
        ? this.mergeArrays(this._analysis.existing[group], this._analysis.missing[group], f => selectedItems.includes(f))
        : this._analysis.merged[group]
  
      // Call sort again as the manual items may have thrown off sorting.
      if (this._options.sort) {
        itemsToReplace.sort()
      }
      
      if (itemsToReplace !== void 0) {
        // Make sure we're keeping track of what changes as we're only loading the quasar.conf.js once.
        this._quasarConf.framework[group] = itemsToReplace
        this._quasarConfFileData = this._quasarConfFileData.replace(this.getGroupRegex(group), this.stringifyConfGroup(group, itemsToReplace))
      }
    }

    if (this._quasarConfFileData !== this._originalQuasarConfFileData) {
      this._originalQuasarConfFileData = this._quasarConfFileData
      fs.writeFileSync(this._quasarConfPath, this._quasarConfFileData, 'utf8')
    }
    
    this._forceApplyChanges = false
  }
  
  /**
   * Simple helper to merge 2 arrays with filter even if arrays aren't initialised.
   * @param arr1
   * @param arr2
   * @param filterFn
   * @returns {*[]}
   */
  mergeArrays (arr1, arr2, filterFn) {
    const arr = arr2 || []
    const filteredArray = typeof filterFn === 'function'
      ? arr.filter(filterFn)
      : arr
    
    return [].concat.apply([], [arr1 || [], filteredArray])
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
  
  /**
   * External access to the accumulative scan result.
   * @returns {{existing: {}, missing: {}, merged: {}}|*}
   */
  getAnalysisResult () {
    return this._analysis
  }
  
  /**
   * HMR console logging will be cleared so maintain an internal version
   * @param msg
   */
  addLog (msg) {
    this._logs.push(msg)
  }
  
  /**
   * Clear current internal log buffer
   */
  clearLog () {
    this._logs = []
  }
  
  /**
   * Write the current log buffer to console
   * To be used when HMR has finished to avoid
   */
  writeLog () {
    for (let log of this._logs) {
      console.log(log)
    }
  }
}
