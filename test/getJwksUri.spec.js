'use strict'

const t = require('tap')
const nock = require('nock')

const { domain } = require('./constants')

const buildGetJwks = require('../src/get-jwks')
const { GetJwksError, errorCode } = require('../src/error')

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

  const expectedError = {
    name: GetJwksError.name,
    code: errorCode.OPENID_CONFIGURATION_REQUEST_FAILED,
    body: { msg: 'baam' },
  }

  await t.rejects(getJwks.getJwksUri(domain), expectedError)
})

t.test(
  'throw error if the discovery request has no jwks_uri property',
  async t => {
    nock(domain)
      .get('/.well-known/openid-configuration')
      .reply(200, { msg: 'baam' })
    const getJwks = buildGetJwks({ providerDiscovery: true })

    const expectedError = {
      name: GetJwksError.name,
      code: errorCode.NO_JWKS_URI,
    }

    await t.rejects(getJwks.getJwksUri(domain), expectedError)
  },
)

t.test('timeout', async t => {
  t.beforeEach(() =>
    nock(domain)
      .get('/.well-known/openid-configuration')
      .reply(200, { jwks_uri: 'http://localhost' }),
  )

  let timeout
  const buildGetJwks = t.mock('../src/get-jwks', {
    'node-fetch': (input, options) => {
      timeout = options.timeout
      return require('node-fetch')(input, options)
    },
  })

  t.test('timeout defaults to 5 seconds', async t => {
    const getJwks = buildGetJwks()
    await getJwks.getJwksUri(domain)
    t.equal(timeout, 5000)
  })

  t.test('ensures that timeout is set to 10 seconds', async t => {
    const getJwks = buildGetJwks({ timeout: 10000 })
    await getJwks.getJwksUri(domain)
    t.equal(timeout, 10000)
  })
})
