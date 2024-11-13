import { getWalletByNetwork } from 'src/wallet/chipnet'

export async function updateAssetBalanceOnLoad (id, wallet, store) {
  const tokenId = id.split('/')[1]
  const updateAssetBalance = 'assets/updateAssetBalance'

  if (id.indexOf('slp/') > -1) {
    return getWalletByNetwork(wallet, 'slp').getBalance(tokenId).then(function (response) {
      store.commit(updateAssetBalance, { id, balance: response.balance })
    })
  } else if (id.indexOf('ct/') > -1) {
    return getWalletByNetwork(wallet, 'bch').getBalance(tokenId).then(response => {
      store.commit(updateAssetBalance, { id, balance: response.balance })
    })
  } else {
    const fetchBchBalancePromises = Promise.all([
      getWalletByNetwork(wallet, 'bch').getBalance().then(function (response) {
        store.commit(updateAssetBalance, {
          id,
          balance: response.balance,
          spendable: response.spendable,
          yield: response.yield
        })
      }),
      store.dispatch('stablehedge/updateTokenBalances')
        .then(() => store.dispatch('stablehedge/updateTokenPrices', { minAge: 60 * 1000 }))
        .catch(console.error),
    ])

    const results = await fetchBchBalancePromises
    return results[0]
  }
}
