'use strict'

const t = require('tap')
const nock = require('nock')
const { createDecoder, createVerifier } = require('fast-jwt')

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
  const myDomain = 'https://localhost/'
  nock(myDomain).get('/.well-known/jwks.json').reply(200, jwks)

  const decodeComplete = createDecoder({ complete: true })
  const sections = decodeComplete(token)
  const {
    header: { kid, alg },
  } = sections

  const getJwks = buildGetJwks()
  const publicKey = await getJwks.getPublicKey({ kid, domain: myDomain, alg })

  const verifyWithPromise = createVerifier({ key: publicKey })
  const payload = await verifyWithPromise(token)

  t.strictEqual(payload.name, 'Jane Doe')
})
