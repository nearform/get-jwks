'use strict'

const nock = require('nock')
const t = require('tap')

const { jwks, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')
const { GetJwksError, errorCode } = require('../src/error')

t.beforeEach(async () => {
  nock.disableNetConnect()
})

t.afterEach(async () => {
  nock.cleanAll()
  nock.enableNetConnect()
})

t.test('rejects if the request fails', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(500, { msg: 'boom' })

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks()

  const expectedError = {
    name: GetJwksError.name,
    code: errorCode.JWKS_REQUEST_FAILED,
    body: { msg: 'boom' },
  }

  await t.rejects(getJwks.getJwk({ domain, alg, kid }), expectedError)
})

t.test('rejects if alg and kid do not match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const getJwks = buildGetJwks()

  await t.rejects(
    getJwks.getJwk({ domain, alg: 'NOT', kid: 'FOUND' }),
    'No matching JWK found in the set.'
  )
})

t.test('returns a jwk if alg and kid match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({ domain, alg: key.alg, kid: key.kid })

  t.ok(jwk)
  t.same(jwk, key)
})

t.test('returns a jwk if alg and kid match and path is specified', async t => {
  nock(domain).get('/otherdir/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks({ jwksPath: '/otherdir/jwks.json' })
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({
    domain,
    alg: key.alg,
    kid: key.kid,
  })

  t.ok(jwk)
  t.same(jwk, key)
})

t.test('returns a jwk if no alg is provided and kid match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const key = jwks.keys[2]

  const jwk = await getJwks.getJwk({ domain, kid: key.kid })

  t.ok(jwk)
  t.same(jwk, key)
})

t.test(
  'returns a jwk if no alg is provided and kid match but jwk has alg',
  async t => {
    nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
    const getJwks = buildGetJwks()
    const key = jwks.keys[1]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })

    t.ok(jwk)
    t.same(jwk, key)
  }
)

t.test('caches a successful response', async t => {
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const getJwks = buildGetJwks()
  const key = jwks.keys[0]
  const { alg, kid } = key

  await getJwks.getJwk({ domain, alg, kid })
  const jwk = await getJwks.getJwk({ domain, alg, kid })

  t.ok(jwk)
  t.same(jwk, key)
})

t.test('does not cache a failed response', async t => {
  nock(domain).get('/.well-known/jwks.json').once().reply(500, { msg: 'boom' })
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks()

  await t.rejects(getJwks.getJwk({ domain, alg, kid }))
  await t.resolves(getJwks.getJwk({ domain, alg, kid }))
})

t.test('rejects if response is an empty object', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, {})
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    'No JWKS found in the response.'
  )
})

t.test('rejects if no JWKS are found in the response', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, { keys: [] })
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    'No JWKS found in the response.'
  )
})

t.test('supports domain without trailing slash', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.ok(key)
})

t.test('supports path without leading slash', async t => {
  nock(domain).get('/otherdir/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks({ jwksPath: 'otherdir/jwks.json' })
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.ok(key)
})

t.test('does not execute concurrent requests', () => {
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return Promise.all([
    getJwks.getJwk({ domain, alg, kid }),
    getJwks.getJwk({ domain, alg, kid }),
  ])
})

t.test('returns a stale cached value if request fails', async t => {
  // allow 2 requests, third will throw an error
  nock(domain).get('/.well-known/jwks.json').twice().reply(200, jwks)
  nock(domain).get('/.well-known/jwks.json').once().reply(500, { boom: true })

  // allow only 1 entry in cache
  const getJwks = buildGetJwks({ max: 1 })
  const [key1, key2] = jwks.keys

  // request key1
  await getJwks.getJwk({
    domain: 'https://localhost',
    alg: key1.alg,
    kid: key1.kid,
  })

  // request key2
  await getJwks.getJwk({
    domain: 'https://localhost',
    alg: key2.alg,
    kid: key2.kid,
  })

  // now key1 is stale
  // request key1
  const key = await getJwks.getJwk({
    domain: 'https://localhost',
    alg: key1.alg,
    kid: key1.kid,
  })

  t.strictSame(key, key1)
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
    ['https://example.com/', 'https://example.com'],
  ]

  allowedCombinations.forEach(([allowedDomain, domainFromToken]) => {
    t.test(
      `allows domain ${allowedDomain} requested with ${domainFromToken}`,
      async t => {
        nock(allowedDomain).get('/.well-known/jwks.json').reply(200, jwks)

        const getJwks = buildGetJwks({
          allowedDomains: [allowedDomain],
        })

        const [{ alg, kid }] = jwks.keys

        t.ok(await getJwks.getJwk({ domain: domainFromToken, alg, kid }))
      }
    )
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
      allowedDomains: ['https://example.com/'],
    })

    const [{ alg, kid }] = jwks.keys

    return t.rejects(
      getJwks.getJwk({ domain, alg, kid }),
      'The domain is not allowed.'
    )
  })
})
