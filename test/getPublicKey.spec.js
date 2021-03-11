'use strict'

const nock = require('nock')
const t = require('tap')
const jwkToPem = require('jwk-to-pem')
const { jwks, domain } = require('./constants')
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

t.test('getPublicKey should return an error if the request fails', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(500, { msg: 'no good' })
  const expectedError = new Error('Internal Server Error')
  expectedError.body = { msg: 'no good' }
  const getJwks = buildGetJwks()
  t.rejects(
    getJwks.getPublicKey({ domain, alg: 'ALG', kid: 'SOME_KEY' }),
    expectedError
  )
})

t.test('getPublicKey should return an error if alg and kid do not match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const expectedError = new Error('No matching JWK found in the set.')
  const getJwks = buildGetJwks()
  t.rejects(
    getJwks.getPublicKey({ domain, alg: 'ALG', kid: 'SOME_KEY' }),
    expectedError
  )
})

t.test('getPublicKey should return a publicKey if alg and kid match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const publicKey = await getJwks.getPublicKey({ domain, alg: localKey.alg, kid: localKey.kid })
  const pem = jwkToPem(jwks.keys[0])
  t.ok(publicKey)
  t.equal(publicKey, pem)
})

t.test('if alg and kid do not match any JWKS it should throw an error', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const alg = 'ALG'
  const kid = 'KEY'
  const cache = getJwks.cache
  const expectedError = new Error('No matching JWK found in the set.')
  t.rejects(
    getJwks.getPublicKey({ domain, alg, kid, cache }),
    expectedError
  )
})

t.test('if the cached JWK is undefined it should fetch the JWKS and set the matching JWK in the cache', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
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

t.test('it will throw an error if no JWKS are found in the response', async t => {
  const jwksNoKeys = {}
  nock(domain).get('/.well-known/jwks.json').reply(200, jwksNoKeys)
  const localKey = jwks.keys[1]
  const alg = localKey.alg
  const kid = localKey.kid
  const getJwks = buildGetJwks()
  const expectedError = new Error('No JWKS found in the response.')
  t.rejects(
    getJwks.getPublicKey({ domain, alg, kid }),
    expectedError
  )
})

t.test('it will throw an error if the keys are empty in the response', async t => {
  const jwksEmptyKeys = { keys: [] }
  nock(domain).get('/.well-known/jwks.json').reply(200, jwksEmptyKeys)
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const getJwks = buildGetJwks()
  const expectedError = new Error('No JWKS found in the response.')
  t.rejects(
    getJwks.getPublicKey({ domain, alg, kid }),
    expectedError
  )
})

t.test('if an issuer provides a domain with a missing trailing slash, it should be handled', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const domainWithMissingTrailingSlash = 'https://localhost'
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const publicKey = await getJwks.getPublicKey({ domain: domainWithMissingTrailingSlash, alg, kid })
  t.ok(publicKey)
})
