<template>
  <q-page class="flex flex-center">
    <img alt="Quasar logo" src="~assets/quasar-logo-full.svg">
    <q-separator class="full-width" style="border: 3px solid black" />

    <q-input v-model="test" />

    <q-icon name="home" />
    <h1 v-touch-hold.mouse="touchHold">Test</h1>
    <h1 v-touch-hold.mouse="touchHold">Test</h1>
  </q-page>
</template>

<style>
</style>

<script>
export default {
  name: 'PageIndex',
  data () {
    return {
      test: ''
    }
  },
  methods: {
    touchHold () {
      this.$q.dialog({
        title: 'Alert',
        message: 'Some message'
      }).onOk(() => {
        console.log('OK')
      }).onCancel(() => {
        console.log('Cancel')
      }).onDismiss(() => {
        console.log('I am triggered on both OK and Cancel')
      })
    }
  },
  created () {
  }
}
</script>
