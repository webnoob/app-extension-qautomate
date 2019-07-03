QAutomate
===

Automate certain tasks when developing in Quasar.

Currently supports:

1. Automatically look for QComponents, Directives and Plugins used within your project and adding them to your Quasar.conf.js file.

# Install
```bash
quasar ext add qautomate
```
Quasar CLI will retrieve it from NPM and install the extension.

## Prompts

(yet to be implemented):

1. AutoFix - Whether or not the AE should auto add to the Quasar conf or just notify in console.
2. Manual Mode - Show a list of missing components / directives / plugins and allow you to select which ones to add.

# Uninstall
```bash
quasar ext remove qautomate
```

# Example

`Index.vue`
Add `<q-input />` to your template without having it in your quasar.conf.js file and it'll automatically add `QInput` and rebuild.

Add `this.$q.loading.show()` to your source in `created` and it'll automatically add the `Loading` plugin to your quasar.conf.js file.

More to follow ...

# Roadmap
* CLI command to check the source for any *unused* components and list / remove from quasar.conf.js file.

# Patreon
If you like (and use) this App Extension, please consider becoming a Quasar [GH Sponsor](https://donate.quasar.dev).
