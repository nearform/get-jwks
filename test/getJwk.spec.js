'use strict'

const nock = require('nock')
const t = require('tap')

const { jwks, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')

t.beforeEach(async () => {
  nock.disableNetConnect()
})

t.afterEach(async () => {
  nock.cleanAll()
  nock.enableNetConnect()
})

t.test('should reject if the request fails', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(500, { msg: 'boom' })

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks()

  const expectedError = new Error('Internal Server Error')
  expectedError.body = { msg: 'boom' }

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    expectedError
  )
})

t.test('should reject if alg and kid do not match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()

  return t.rejects(
    getJwks.getJwk({ domain, alg: 'NOT', kid: 'FOUND' }),
    'No matching JWK found in the set.'
  )
})

t.test('should return a jwk if alg and kid match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({ domain, alg: key.alg, kid: key.kid })

  t.ok(jwk)
  t.deepEqual(jwk, key)
})

t.test('if alg and kid do not match any jwks, the cached jwk should be a rejecting promise', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const alg = 'NOT'
  const kid = 'FOUND'
  const cache = getJwks.cache

  await t.rejects(getJwks.getJwk({ domain, alg, kid }), 'No matching JWK found in the set.')
  await t.rejects(cache.get(`${alg}:${kid}:${domain}`), 'No matching JWK found in the set.')
})

t.test('it should fetch the JWKS and set the matching JWK in the cache', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const key = jwks.keys[1]
  const alg = key.alg
  const kid = key.kid
  const cache = getJwks.cache
  const jwk = await getJwks.getJwk({ domain, alg, kid })
  t.ok(jwk)
  t.deepEqual(jwk, key)
  t.deepEqual(await cache.get(`${alg}:${kid}:${domain}`), key)
})

t.test('it rejects if no JWKS are found in the response', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, {})
  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks()

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    'No JWKS found in the response.'
  )
})

t.test('it rejects if no JWKS are found in the response', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, { keys: [] })
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    'No JWKS found in the response.'
  )
})

t.test('should support domain without trailing slash', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.ok(key)
})

t.test('if there is already a JWK in cache, it should not make an http request', async t => {
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  getJwks.cache.set(`${alg}:${kid}:${domain}`, Promise.resolve(localKey))
  const secret = await getJwks.getJwk({ domain, alg, kid })
  t.ok(secret)
})

t.test('should not execute concurrent requests', () => {
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return Promise.all([
    getJwks.getJwk({ domain, alg, kid }),
    getJwks.getJwk({ domain, alg, kid })
  ])
})

t.test('allowed domains', async t => {
  t.test('allows any domain by default', async t => {
    const domain = 'https://example.com'

    nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

    const getJwks = buildGetJwks()

    const [{ alg, kid }] = jwks.keys

    t.ok(await getJwks.getJwk({ domain, alg, kid }))
  })

  const allowedCombinations = [
    // same without trailing slash
    ['https://example.com', 'https://example.com'],
    // same with trailing slash
    ['https://example.com/', 'https://example.com/'],
    // one without, one with
    ['https://example.com', 'https://example.com/'],
    // one with, one without
    ['https://example.com/', 'https://example.com']
  ]

  allowedCombinations.forEach(([allowedDomain, domainFromToken]) => {
    t.test(`allows domain ${allowedDomain} requested with ${domainFromToken}`, async t => {
      nock(allowedDomain).get('/.well-known/jwks.json').reply(200, jwks)

      const getJwks = buildGetJwks({
        allowedDomains: [allowedDomain]
      })

      const [{ alg, kid }] = jwks.keys

      t.ok(await getJwks.getJwk({ domain: domainFromToken, alg, kid }))
    })
  })

  t.test('allows multiple domains', async t => {
    const domain1 = 'https://example1.com'
    const domain2 = 'https://example2.com'

    nock(domain1).get('/.well-known/jwks.json').reply(200, jwks)
    nock(domain2).get('/.well-known/jwks.json').reply(200, jwks)

    const getJwks = buildGetJwks({ allowedDomains: [domain1, domain2] })

    const [{ alg, kid }] = jwks.keys

    t.ok(await getJwks.getJwk({ domain: domain1, alg, kid }))
    t.ok(await getJwks.getJwk({ domain: domain2, alg, kid }))
  })

  t.test('forbids domain outside of the allow list', async t => {
    const getJwks = buildGetJwks({
      allowedDomains: ['https://example.com/']
    })

    const [{ alg, kid }] = jwks.keys

    return t.rejects(getJwks.getJwk({ domain, alg, kid }), 'The domain is not allowed.')
  })
})
