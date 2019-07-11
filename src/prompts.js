module.exports = () => {
  return [
    {
      // "iconSet" will be the variable
      // storing the answer
      name: 'quasarConfFixMode',
      type: 'list',
      message: 'Please select a fix mode (use arrow keys or num keys 1-3 to select).',
      choices: [
        {
          name: '1. Automatic - Add components, directives and plugins when they are found to be missing.',
          value: 'automatic', // value of the answer variable
          short: 'Automatic' // Short name displayed after user picks this
        },
        {
          name: '2. Manual - Present a list of missing components, directives and plugins and you choose what should be added.',
          value: 'manual', // value of the answer variable
          short: 'Manual' // Short name displayed after user picks this
        },
        {
          name: '3. Warn Only - Present a list of missing components, directives and plugins and nothing more.',
          value: 'warn', // value of the answer variable
          short: 'Warn Only' // Short name displayed after user picks this
        }
      ]
    },
    {
      name: 'sort',
      type: 'confirm',
      message: 'Automatically sort items alphabetically?',
      default: true
    }
  ]
}
