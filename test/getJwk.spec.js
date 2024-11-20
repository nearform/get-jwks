'use strict'

const nock = require('nock')
const {beforeEach, afterEach, test, describe} = require('node:test')

const { jwks, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')
const { GetJwksError, errorCode } = require('../src/error')

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

test('rejects if the request fails', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(500, { msg: 'boom' })

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks()

  const expectedError = {
    name: GetJwksError.name,
    code: errorCode.JWKS_REQUEST_FAILED,
    body: { msg: 'boom' },
  }

  await t.assert.rejects(getJwks.getJwk({ domain, alg, kid }), expectedError)
})

test('rejects if alg and kid do not match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const getJwks = buildGetJwks()

  await t.assert.rejects(
    getJwks.getJwk({ domain, alg: 'NOT', kid: 'FOUND' }),
    'No matching JWK found in the set.',
  )
})

test('returns a jwk if alg and kid match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({ domain, alg: key.alg, kid: key.kid })

  t.assert.ok(jwk)
  t.assert.deepStrictEqual(jwk, key)
})

test('returns a jwk if alg and kid match and path is specified', async t => {
  nock(domain).get('/otherdir/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks({ jwksPath: '/otherdir/jwks.json' })
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({
    domain,
    alg: key.alg,
    kid: key.kid,
  })

  t.assert.ok(jwk)
  t.assert.deepStrictEqual(jwk, key)
})

test('returns a jwk if no alg is provided and kid match', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const key = jwks.keys[2]

  const jwk = await getJwks.getJwk({ domain, kid: key.kid })

  t.assert.ok(jwk)
  t.assert.deepStrictEqual(jwk, key)
})

test(
  'returns a jwk if no alg is provided and kid match but jwk has alg',
  async t => {
    nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
    const getJwks = buildGetJwks()
    const key = jwks.keys[1]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })

    t.assert.ok(jwk)
    t.assert.deepStrictEqual(jwk, key)
  },
)

test('caches a successful response', async t => {
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const getJwks = buildGetJwks()
  const key = jwks.keys[0]
  const { alg, kid } = key

  await getJwks.getJwk({ domain, alg, kid })
  const jwk = await getJwks.getJwk({ domain, alg, kid })

  t.assert.ok(jwk)
  t.assert.deepStrictEqual(jwk, key)
})

test('does not cache a failed response', async t => {
  nock(domain).get('/.well-known/jwks.json').once().reply(500, { msg: 'boom' })
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks()

  await t.assert.rejects(getJwks.getJwk({ domain, alg, kid }))
  await getJwks.getJwk({ domain, alg, kid })
})

test('rejects if response is an empty object', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, {})
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return t.assert.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    new GetJwksError('NO_JWKS', 'No JWKS found in the response.'),
  )
})

test('rejects if no JWKS are found in the response', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, { keys: [] })
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return t.assert.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    new GetJwksError('NO_JWKS', 'No JWKS found in the response.'),
  )
})

test('supports domain without trailing slash', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.assert.ok(key)
})

test('supports path without leading slash', async t => {
  nock(domain).get('/otherdir/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks({ jwksPath: 'otherdir/jwks.json' })
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.assert.ok(key)
})

test('does not execute concurrent requests', () => {
  nock(domain).get('/.well-known/jwks.json').once().reply(200, jwks)

  const getJwks = buildGetJwks()
  const [{ alg, kid }] = jwks.keys

  return Promise.all([
    getJwks.getJwk({ domain, alg, kid }),
    getJwks.getJwk({ domain, alg, kid }),
  ])
})

test('returns a stale cached value if request fails', async t => {
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

  t.assert.deepStrictEqual(key, key1)
})

describe('allowed domains', () => {
  test('allows any domain by default', async t => {
    const domain = 'https://example.com'

    nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

    const getJwks = buildGetJwks()

    const [{ alg, kid }] = jwks.keys

    t.assert.ok(await getJwks.getJwk({ domain, alg, kid }))
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
    test(
      `allows domain ${allowedDomain} requested with ${domainFromToken}`,
      async t => {
        nock(allowedDomain).get('/.well-known/jwks.json').reply(200, jwks)

        const getJwks = buildGetJwks({
          issuersWhitelist: [allowedDomain],
        })

        const [{ alg, kid }] = jwks.keys

        t.assert.ok(await getJwks.getJwk({ domain: domainFromToken, alg, kid }))
      },
    )
  })

  test('allows multiple domains', async t => {
    const domain1 = 'https://example1.com'
    const domain2 = 'https://example2.com'

    nock(domain1).get('/.well-known/jwks.json').reply(200, jwks)
    nock(domain2).get('/.well-known/jwks.json').reply(200, jwks)

    const getJwks = buildGetJwks({ issuersWhitelist: [domain1, domain2] })

    const [{ alg, kid }] = jwks.keys

    t.assert.ok(await getJwks.getJwk({ domain: domain1, alg, kid }))
    t.assert.ok(await getJwks.getJwk({ domain: domain2, alg, kid }))
  })

  test('checks token issuer', async t => {
    const domain = 'https://example.com/realms/REALM_NAME'

    nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

    const getJwks = buildGetJwks({
      checkIssuer: (issuer) => {
        const url = new URL(issuer)
        const baseUrl = `${url.protocol}//${url.hostname}/`
        return baseUrl === 'https://example.com/'
      }
    })

    const [{ alg, kid }] = jwks.keys

    t.assert.ok(await getJwks.getJwk({ domain, alg, kid }))
  })

  test('forbids invalid issuer', async t => {
    const getJwks = buildGetJwks({
      checkIssuer: (issuer) => {
        const url = new URL(issuer)
        const baseUrl = `${url.protocol}//${url.hostname}/`
        return baseUrl === 'https://example.com/'
      }
    })

    const [{ alg, kid }] = jwks.keys

    return t.assert.rejects(
      getJwks.getJwk({ domain, alg, kid }),
      'Issuer is not allowed.',
    )
  })

  test('forbids domain outside of the allow list', async t => {
    const getJwks = buildGetJwks({
      issuersWhitelist: ['https://example.com/'],
    })

    const [{ alg, kid }] = jwks.keys

    return t.assert.rejects(
      getJwks.getJwk({ domain, alg, kid }),
      new GetJwksError('DOMAIN_NOT_ALLOWED', 'The domain is not allowed.'),
    )
  })
})

test('timeout', async t => {
  const domain = 'https://example.com'
  const [{ alg, kid }] = jwks.keys

  beforeEach(() =>
    nock(domain).get('/.well-known/jwks.json').reply(200, jwks),
  )

  let timeout
  const buildGetJwks = t.mock('../src/get-jwks', {
    'node-fetch': (init, options) => {
      timeout = options.timeout
      return require('node-fetch')(init, options)
    },
  })

  test('timeout defaults to 5 seconds', async t => {
    const getJwks = buildGetJwks()
    await getJwks.getJwk({ domain, alg, kid })
    t.assert.equal(timeout, 5000)
  })

  test('ensures that timeout is set to 10 seconds', async t => {
    const getJwks = buildGetJwks({ timeout: 10000 })
    await getJwks.getJwk({ domain, alg, kid })
    t.assert.equal(timeout, 10000)
  })
})
