'use strict'

const t = require('tap')
const nock = require('nock')

const { domain } = require('./constants')

const buildGetJwks = require('../src/get-jwks')

t.beforeEach(async () => {
  nock.disableNetConnect()
})

t.afterEach(async () => {
  nock.cleanAll()
  nock.enableNetConnect()
})

t.test('throw error if the discovery request fails', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .reply(500, { msg: 'baam' })
  const getJwks = buildGetJwks({ providerDiscovery: true })

  const expectedError = new Error('Internal Server Error')

  await t.rejects(getJwks.getJwksUri(domain), expectedError)
})

t.test(
  'throw error if the discovery request has no jwks_uri property',
  async t => {
    nock(domain)
      .get('/.well-known/openid-configuration')
      .reply(200, { msg: 'baam' })
    const getJwks = buildGetJwks({ providerDiscovery: true })

    const expectedError = new Error(
      'No valid jwks_uri key found in providerConfig'
    )

    await t.rejects(getJwks.getJwksUri(domain), expectedError)
  }
)
