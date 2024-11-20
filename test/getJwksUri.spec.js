'use strict'

const { beforeEach, afterEach, test, describe } = require('node:test')
const nock = require('nock')

const { domain } = require('./constants')

const buildGetJwks = require('../src/get-jwks')
const { GetJwksError, errorCode } = require('../src/error')

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

test('throw error if the discovery request fails', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .reply(500, { msg: 'baam' })
  const getJwks = buildGetJwks({ providerDiscovery: true })

  const expectedError = {
    name: GetJwksError.name,
    code: errorCode.OPENID_CONFIGURATION_REQUEST_FAILED,
    body: { msg: 'baam' },
  }

  await t.assert.rejects(getJwks.getJwksUri(domain), expectedError)
})

test(
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

    await t.assert.rejects(getJwks.getJwksUri(domain), expectedError)
  },
)

describe('timeout', async t => {
  beforeEach(() =>
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

  test('timeout defaults to 5 seconds', async t => {
    const getJwks = buildGetJwks()
    await getJwks.getJwksUri(domain)
    t.assert.equal(timeout, 5000)
  })

  test('ensures that timeout is set to 10 seconds', async t => {
    const getJwks = buildGetJwks({ timeout: 10000 })
    await getJwks.getJwksUri(domain)
    t.assert.equal(timeout, 10000)
  })
})
