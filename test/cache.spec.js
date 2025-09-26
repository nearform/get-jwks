'use strict'

const {test} = require('node:test')
const nock = require('nock')
const jwkToPem = require('jwk-to-pem')

const { jwks, domain } = require('./constants')

const buildGetJwks = require('../src/get-jwks')

test(
  'if there is already a key in cache, it should not make a http request',
  async t => {
    const getJwks = buildGetJwks()
    const localKey = jwks.keys[0]
    const alg = localKey.alg
    const kid = localKey.kid

    const cacheKey = getJwks.generateCacheKey(alg, kid, domain)
    getJwks.cache.set(cacheKey, Promise.resolve(localKey))

    const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
    const jwk = await getJwks.getJwk({ domain, alg, kid })
    t.assert.ok(publicKey)
    t.assert.ok(jwk)
    t.assert.equal(publicKey, jwkToPem(jwk))
    t.assert.equal(jwk, localKey)
  }
)

test(
  'if initialized without any cache settings it should use default values',
  async t => {
    nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
    const getJwks = buildGetJwks()
    const cache = getJwks.cache
    const [{ alg, kid }] = jwks.keys
    const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
    const jwk = await getJwks.getJwk({ domain, alg, kid })

    t.assert.ok(publicKey)
    t.assert.ok(jwk)
    t.assert.ok(getJwks.cache)
    t.assert.equal(cache.max, 100)
    t.assert.equal(cache.ttl, 60000)
  }
)

test('if cache key is generated with the correct encoding', async t => {
  const getJwks = buildGetJwks()
  const alg = 'RS256'
  const kid = 'KEY_1'
  const normalizedDomain = 'https://example.com/'

  const expectedCacheKey = 'RS256:KEY_1:https%3A%2F%2Fexample.com%2F'

  const generatedCacheKey = getJwks.generateCacheKey(
    alg,
    kid,
    normalizedDomain,
  )

  t.assert.equal(generatedCacheKey, expectedCacheKey)
})

test('if cache poisoning is prevented', async t => {
  const attackerJwk = {
    kid: 'legitkey',
    alg: 'RS256',
    kty: 'RSA',
    use: 'sig',
    n: 'attacker_modulus_data',
    e: 'AQAB'
  }

  const legitimateJwk = {
    kid: 'legitkey:https://evil.com/?',
    alg: 'RS256',
    kty: 'RSA',
    use: 'sig',
    n: 'legitimate_modulus_data',
    e: 'AQAB'
  }

  nock('https://evil.com/')
    .get('/')
    .query(true)
    .reply(200, { keys: [attackerJwk] })

  nock('https://legit.com/')
    .get('/.well-known/jwks.json')
    .reply(200, { keys: [legitimateJwk] })

  const getJwks = buildGetJwks()

  await getJwks.getJwk({
    domain: 'https://evil.com/?:https://legit.com',
    alg: 'RS256',
    kid: 'legitkey'
  })

  const legitimateJwkResult = await getJwks.getJwk({
    domain: 'https://legit.com',
    alg: 'RS256',
    kid: 'legitkey:https://evil.com/?'
  })

  t.assert.ok(legitimateJwkResult)
  t.assert.deepEqual(legitimateJwkResult, legitimateJwk)
})
