<template>
  <q-page class="flex flex-center">
    <img alt="Quasar logo" src="~assets/quasar-logo-full.svg">

    <q-separator class="full-width q-mx-lg" style="border: 2px solid black" />

    <q-input v-model="test" label="I'm a little input short and stout..." />

    <q-icon name="home" class="full-width q-mx-lg" />
    <br />
    <h5 v-touch-hold.mouse="touchHold">Touch hold me!</h5>
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
