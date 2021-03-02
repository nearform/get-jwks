'use strict'

const t = require('tap')
const nock = require('nock')
const jwkToPem = require('jwk-to-pem')

const jwks = require('../constants').jwks

const buildGetJwks = require('../src/get-jwks')

t.test('if there is already a key in cache, it should not make a http request', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid

  getJwks.cache.set(`${alg}:${kid}:${domain}`, localKey)

  const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
  const jwk = await getJwks.getJwk({ domain, alg, kid })
  t.ok(publicKey)
  t.ok(jwk)
  t.equal(publicKey, jwkToPem(jwk))
  t.deepEqual(jwk, localKey)
})

t.test('if initialized without any cache settings it should use default values', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const cache = getJwks.cache
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
  const jwk = await getJwks.getJwk({ domain, alg, kid })
  t.ok(publicKey)
  t.ok(jwk)
  t.ok(getJwks.cache)
  t.equal(cache.max, 100)
  t.equal(cache.ttl, 60000)
})

t.test('calling the clear cache function resets the cache and clears keys', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const cache = getJwks.cache
  const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
  const key = await getJwks.getJwk({ domain, alg, kid })
  t.ok(publicKey)
  t.ok(key)
  t.deepEqual(cache.get(`${alg}:${kid}:${domain}`), localKey)
  getJwks.clearCache()
  t.equal(cache.get(`${alg}:${kid}:${domain}`), undefined)
})
