<template>
  <div style="background-color: #ECF3F3; min-height: 100vh;padding-top:70px;">
    <HeaderNav
      title="Wallet Connect"
      backnavpath="/apps"
      style="position: fixed; top: 0; background: #ECF3F3; width: 100%; z-index: 100 !important;"
    />
    <QrScanner
      v-model="scanner.show"
      :front-camera="scanner.frontCamera"
      @decode="onScannerDecode"
    />

    <div class="q-px-md">
      <div v-if="!connector">
        <q-form @submit="handShakeFormSubmit">
          <q-input
            label="Input wallet connect uri"
            v-model="handshakeFormData.walletConnectUri"
          />
          <div class="row items-center q-mt-sm">
            <q-btn
              no-caps
              label="Connect"
              type="submit"
            />
          </div>
        </q-form>
        <div class="q-mt-md text-center text-grey">
          or scan qr code
        </div>
        <div class="q-mt-md row justify-center items-center">
          <q-btn
            rounded
            padding="md"
            icon="camera_alt"
            @click="scanner.show = true"
          />
        </div>
      </div>
      <div v-else>
        <q-card>
          <q-card-section>
            <div class="row items-start">
              <div class="text-grey">
                Connected to:
              </div>
              <q-space/>
              <q-btn
                size="sm"
                padding="none xs"
                no-caps
                flat
                label="Disconnect"
                @click="diconnectConnector"
              />
            </div>
            <div class="row items-center justify-start no-wrap q-gutter-x-sm">
              <img
                v-if="parsedPeerMeta.icon"
                width="50"
                height="auto"
                :src="parsedPeerMeta.icon"
              />
              <div class="text-h6">{{ parsedPeerMeta.name }}</div>
            </div>
            <div v-if="parsedPeerMeta.url" class="q-mt-sm text-body2">
              <a :href="parsedPeerMeta.url" target="_blank">{{ parsedPeerMeta.url }}</a>
            </div>
            <div v-if="parsedPeerMeta.description" class="q-mt-sm text-body2">
              {{ parsedPeerMeta.description }}
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-weight-medium">Accounts</div>
            <q-list bordered separator style="border-radius: 14px; background: #fff" class="q-mt-sm">
              <template v-if="Array.isArray(connector.accounts)">
                <q-item
                  v-for="(account, index) in connector.accounts"
                  :key="index"
                  clickable
                  v-ripple
                  @click="copyToClipboard(account)"
                >
                  <q-item-section>
                    <q-item-label>{{ account | ellipsisText }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>
<script>
import { getMnemonic, Wallet } from '../../wallet'
import { createConnector, getPreviousConnector, callRequestHandler } from '../../wallet/walletconnect'
import QrScanner from '../../components/qr-scanner.vue'
import HeaderNav from '../../components/header-nav'

export default {
  name: 'WalletConnect',
  components: { QrScanner, HeaderNav },
  data() {
    return {
      handshakeFormData: {
        walletConnectUri: '',
      },

      scanner: {
        show: false,
        frontCamera: false,
      },
      wallet: null,
      connector: null,
    }
  },
  filters: {
    ellipsisText(value) {
      if (typeof value !== 'string') return ''
      if (value.length <= 12) return value
      return value.substr(0, 5) + '...' + value.substr(value.length-5, value.length)
    }
  },
  computed: {
    parsedPeerMeta () {
      const meta = {
        name: '',
        icon: '',
        description: '',
        url: '',
      }

      if (this.connector && this.connector._peerMeta) {
        meta.name = this.connector._peerMeta.name
        meta.description = this.connector._peerMeta.description
        meta.url = this.connector._peerMeta.url
        if (Array.isArray(this.connector._peerMeta.icons) && this.connector._peerMeta.icons.length) {
          meta.icon = this.connector._peerMeta.icons[0]
        }
      }

      return meta
    }
  },

  methods: {
    copyToClipboard (value) {
      this.$copyText(value)
      this.$q.notify({
        message: 'Copied to clipboard',
        timeout: 200
      })
    },

    onScannerDecode (content) {
      this.handshakeFormData.walletConnectUri = content
      this.scanner.show = false
      this.handShakeFormSubmit()
    },

    handShakeFormSubmit() {
      this.initializeConnector(this.handshakeFormData.walletConnectUri)
    },

    initializeConnector (uri) {
      const connector = createConnector(uri)
      this.connector = connector
      // console.log('got connector:', this.connector)
      this.attachEventsToConnector()
    },

    diconnectConnector() {
      if (!this.connector) return

      this.detachEventstToConnector()
      this.connector.killSession()
      this.connector = null
      this.handshakeFormData.walletConnectUri = ''
    },

    detachEventstToConnector() {
      if (!this.connector) return

      this.connector.off('session_request')
      this.connector.off('disconnect')
      this.connector.off('call_request')
    },

    attachEventsToConnector () {
      if (!this.connector) return

      this.connector.on('session_request', (error, payload) => {
        console.log('session_request:', error, payload)
        if (error) {
          throw error;
        }

        // NOTE: for testing in dev
        // Test site: https://example.walletconnect.org/
        // use `chainId: 1`
        this.connector.approveSession({
          accounts: [this.wallet.sBCH._wallet.address],
          chainId: this.wallet.sBCH._testnet ? 10001 : 10000,
          // chainId: 1,
        })

      })

      this.connector.on('disconnect', (error, payload) => {
        console.log('disconnect:', error, payload)
        if (error) {
          throw error;
        }

        this.$q.dialog({
          title: 'Wallet Connect',
          message: 'Disconnected!',
        })

        this.diconnectConnector()
      })

      this.connector.on('call_request', (error, payload) => {
        console.log('call_request:', error, payload)
        if (error) {
          throw error;
        }

        this.$q.dialog({
          title: 'WalletConnect call request',
          message: payload.method + ':\n' + payload.params,
          cancel: true,
          persistent: true
        })
          .onOk(() => {
            // TODO: correct implementation for call requests
            callRequestHandler(this.connector, payload, this.wallet.sBCH._wallet)
          })
          .onCancel(() => {
            this.connector.rejectRequest({
              id: payload.id,
              error: {
                message: 'Rejected by user'
              }
            })
          })
      })
    },

    loadWallet () {
      const vm = this
      getMnemonic().then(function (mnemonic) {
        vm.wallet = new Wallet(mnemonic, vm.isTestnet)
      })
    },
  },

  beforeDestroy() {
    this.diconnectConnector()
  },

  mounted () {
    this.loadWallet()
    const connector = getPreviousConnector()
    if (connector) {
      this.connector = connector
      this.attachEventsToConnector()
    }
  }
}
</script>
