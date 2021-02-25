'use strict'

const nock = require('nock')
const t = require('tap')
const jwkToPem = require('jwk-to-pem')

const buildGetJwks = require('../src/get-jwks')

t.beforeEach((done) => {
  nock.disableNetConnect()
  done()
})

t.afterEach((done) => {
  nock.cleanAll()
  nock.enableNetConnect()
  done()
})

t.test('should return an error if the request fails', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(500, { msg: 'no good' })
  try {
    const getJwks = buildGetJwks()
    await getJwks.getPublicKey({ domain: 'https://localhost/', alg: 'ALG', kid: 'SOME_KEY' })
  } catch (e) {
    t.equal(e.message, 'Internal Server Error')
    t.same(e.body, { msg: 'no good' })
  }
})

t.test('should return an error if alg and kid do not match', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  try {
    const getJwks = buildGetJwks()
    await getJwks.getPublicKey({ domain: 'https://localhost/', alg: 'ALG', kid: 'SOME_KEY' })
  } catch (e) {
    t.equal(e.message, 'No matching JWK found in the set.')
  }
})

t.test('should return a publicKey if alg and kid match', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const publicKey = await getJwks.getPublicKey({ domain: 'https://localhost/', alg: localKey.alg, kid: localKey.kid })
  const pem = jwkToPem(jwks.keys[0])
  t.ok(publicKey)
  t.equal(publicKey, pem)
})

t.test('if alg and kid do not match any jwks it should throw an error', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const alg = 'ALG'
  const kid = 'KEY'
  const cache = getJwks.cache

  try {
    await getJwks.getPublicKey({ domain, alg, kid, cache })
  } catch (e) {
    t.equal(e.message, 'No matching JWK found in the set.')
  }
})

t.test('if the cached key is undefined it should fetch the jwks and set the key in the cache', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[1]
  const alg = localKey.alg
  const kid = localKey.kid
  const cache = getJwks.cache
  getJwks.clearCache()
  const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
  const pem = jwkToPem(localKey)
  t.ok(publicKey)
  t.equal(publicKey, pem)
  t.deepEqual(cache.get(`${alg}:${kid}:${domain}`), localKey)
})

t.test('it will throw an error if no keys are found in the JWKS', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksNoKeys)
  const domain = 'https://localhost/'
  const localKey = jwks.keys[1]
  const alg = localKey.alg
  const kid = localKey.kid

  try {
    const getJwks = buildGetJwks()
    await getJwks.getPublicKey({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No JWKS found in the response.')
  }
})

t.test('it will throw an error if the keys are empty in the JWKS', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksEmptyKeys)
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid

  try {
    const getJwks = buildGetJwks()
    await getJwks.getPublicKey({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No JWKS found in the response.')
  }
})

t.test('if an issuer provides a domain with a missing trailing slash, it should be handled', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const domainWithMissingTrailingSlash = 'https://localhost'
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const publicKey = await getJwks.getPublicKey({ domain: domainWithMissingTrailingSlash, alg, kid })
  t.ok(publicKey)
})

const jwks = {
  keys: [
    {
      alg: 'RS512',
      kid: 'KEY_0',
      e: 'AQAB',
      kty: 'RSA',
      n: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImp0aSI6ImZmMTBmMTg1LWFiODEtNDhjYS1hZmI1LTdkY2FhMzNmYzgzNSIsImlhdCI6MTYxNDEwMzkxNiwiZXhwIjoxNjE0MTA3NTE2fQ.mLx1TZaHDhcymZFmLM7pfBhowY7CEgjuxr54LPXpGXc',
      use: 'sig'
    },
    {
      alg: 'RS256',
      kid: 'KEY_1',
      e: 'AQAB',
      kty: 'RSA',
      n: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvZSBCbG9nZ3MiLCJhZG1pbiI6dHJ1ZSwianRpIjoiZmYxMGYxODUtYWI4MS00OGNhLWFmYjUtN2RjYWEzM2ZjODM1IiwiaWF0IjoxNjE0MTAzOTE2LCJleHAiOjE2MTQxMDc1NDl9.4PQiX1jCDiTbRnwWusQHW2UNHxpGgpcRaUxSt4K6C8I',
      use: 'sig'
    }
  ]
}

const jwksNoKeys = {}
const jwksEmptyKeys = { keys: [] }
