'use strict'

const t = require('tap')
const nock = require('nock')
const { createVerifier } = require('fast-jwt')

const { jwks, token } = require('./constants')
const buildGetJwks = require('../src/get-jwks')

t.beforeEach(async () => {
  nock.disableNetConnect()
})

t.afterEach(async () => {
  nock.cleanAll()
  nock.enableNetConnect()
})

t.test('fast-jwt integration tests', async t => {
  const domain = 'https://localhost/'
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const getJwks = buildGetJwks()
  const verifyWithPromise = createVerifier({
    key: async function ({ header }) {
      const publicKey = await getJwks.getPublicKey({
        kid: header.kid,
        alg: header.alg,
        domain,
      })
      return publicKey
    },
  })
  const payload = await verifyWithPromise(token)

  t.equal(payload.name, 'Jane Doe')
})
