'use strict'

const nock = require('nock')
const t = require('tap')

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

t.test('getJwk should return an error if the request fails', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(500, { msg: 'no good' })
  const expectedError = new Error('Internal Server Error')
  expectedError.body = { msg: 'no good' }
  const getJwks = buildGetJwks()
  t.rejects(
    getJwks.getJwk({ domain: 'https://localhost/', alg: 'ALG', kid: 'SOME_KEY' }),
    expectedError
  )
})

t.test('getJwk should return an error if alg and kid do not match', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const expectedError = new Error('No matching JWK found in the set.')
  const getJwks = buildGetJwks()
  t.rejects(
    getJwks.getJwk({ domain: 'https://localhost/', alg: 'ALG', kid: 'SOME_KEY' }),
    expectedError
  )
})

t.test('getJwk should return a jwk if alg and kid match', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const jwk = await getJwks.getJwk({ domain: 'https://localhost/', alg: localKey.alg, kid: localKey.kid })
  t.ok(jwk)
  t.deepEqual(jwk, localKey)
})

t.test('if alg and kid do not match any jwks, the cached jwk should be set to null', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const alg = 'ALG'
  const kid = 'KEY'
  const cache = getJwks.cache

  try {
    await getJwks.getJwk({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No matching JWK found in the set.')
  }

  t.deepEqual(cache.get(`${alg}:${kid}:${domain}`), null)
})

t.test('if the cached JWK is undefined it should fetch the JWKS and set the matching JWK in the cache', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[1]
  const alg = localKey.alg
  const kid = localKey.kid
  const cache = getJwks.cache
  const jwk = await getJwks.getJwk({ domain, alg, kid })
  t.ok(jwk)
  t.deepEqual(jwk, localKey)
  t.deepEqual(cache.get(`${alg}:${kid}:${domain}`), localKey)
})

t.test('it will throw an error if no JWKS are found in the response', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksNoKeys)
  const domain = 'https://localhost/'
  const localKey = jwks.keys[1]
  const alg = localKey.alg
  const kid = localKey.kid
  const expectedError = new Error('No JWKS found in the response.')
  const getJwks = buildGetJwks()
  t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    expectedError
  )
})

t.test('it will throw an error if no JWKS are found in the response', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksEmptyKeys)
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const expectedError = new Error('No JWKS found in the response.')
  const getJwks = buildGetJwks()
  t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    expectedError
  )
})

t.test('if an issuer provides a domain with a missing trailing slash, it should be handled', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const domainWithMissingTrailingSlash = 'https://localhost'
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const key = await getJwks.getJwk({ domain: domainWithMissingTrailingSlash, alg, kid })
  t.ok(key)
})

t.test('if there is already a JWK in cache, it should not make an http request', async t => {
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  getJwks.cache.set(`${alg}:${kid}:${domain}`, localKey)
  const secret = await getJwks.getJwk({ domain, alg, kid })
  t.ok(secret)
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
