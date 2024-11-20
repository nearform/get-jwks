'use strict'

const nock = require('nock')
const {beforeEach, afterEach, test, describe} = require('node:test')

const { oidcConfig, jwks, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')
const { errorCode, GetJwksError } = require('../src/error')

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

test('rejects if the discovery request fails', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .reply(500, { msg: 'baam' })

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks({ providerDiscovery: true })

  const expectedError = {
    name: GetJwksError.name,
    code: errorCode.OPENID_CONFIGURATION_REQUEST_FAILED,
    body: { msg: 'baam' },
  }
  await t.assert.rejects(getJwks.getJwk({ domain, alg, kid }), expectedError)
})

test('rejects if the request fails', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(500, { msg: 'boom' })

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks({ providerDiscovery: true })

  const expectedError = {
    name: GetJwksError.name,
    code: errorCode.JWKS_REQUEST_FAILED,
    body: { msg: 'boom' },
  }
  expectedError.body = { msg: 'boom' }

  await t.assert.rejects(getJwks.getJwk({ domain, alg, kid }), expectedError)
})

test('returns a jwk if alg and kid match for discovery', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({ domain, alg: key.alg, kid: key.kid })

  t.assert.ok(jwk)
  t.assert.deepStrictEqual(jwk, key)
})

test(
  'returns a jwk if no alg is provided and kid match for discovery',
  async t => {
    nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
    nock(domain).get('/.well-known/certs').reply(200, jwks)
    const getJwks = buildGetJwks({ providerDiscovery: true })
    const key = jwks.keys[2]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })

    t.assert.ok(jwk)
    t.assert.deepStrictEqual(jwk, key)
  }
)

test(
  'returns a jwk if no alg is provided and kid match for discovery but jwk has alg',
  async t => {
    nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
    nock(domain).get('/.well-known/certs').reply(200, jwks)
    const getJwks = buildGetJwks({ providerDiscovery: true })
    const key = jwks.keys[1]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })

    t.assert.ok(jwk)
    t.assert.deepStrictEqual(jwk, key)
  }
)

test('caches a successful response for discovery', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)

  const getJwks = buildGetJwks({ providerDiscovery: true })
  const key = jwks.keys[0]
  const { alg, kid } = key

  await getJwks.getJwk({ domain, alg, kid })
  const jwk = await getJwks.getJwk({ domain, alg, kid })

  t.assert.ok(jwk)
  t.assert.deepStrictEqual(jwk, key)
})

test('does not cache a failed response for discovery', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .twice()
    .reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(500, { msg: 'boom' })
  nock(domain).get('/.well-known/certs').reply(200, jwks)

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks({ providerDiscovery: true })

  await t.assert.rejects(getJwks.getJwk({ domain, alg, kid }))
  await getJwks.getJwk({ domain, alg, kid })
})

test('rejects if response is an empty object for discovery', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, {})
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  return t.assert.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    new GetJwksError('NO_JWKS', 'No JWKS found in the response.')
  )
})

test('rejects if no JWKS are found in the response', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, { keys: [] })
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  return t.assert.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    new GetJwksError('NO_JWKS', 'No JWKS found in the response.')
  )
})

test('supports domain without trailing slash for discovery', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .once()
    .reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.assert.ok(key)
})

test('does not execute concurrent requests for discovery', () => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .once()
    .reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').once().reply(200, jwks)

  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  return Promise.all([
    getJwks.getJwk({ domain, alg, kid }),
    getJwks.getJwk({ domain, alg, kid }),
  ])
})

test(
  'returns a stale cached value if request fails for discovery',
  async t => {
    // allow 2 requests, third will throw an error
    nock(domain)
      .get('/.well-known/openid-configuration')
      .thrice()
      .reply(200, oidcConfig)
    nock(domain).get('/.well-known/certs').twice().reply(200, jwks)
    nock(domain).get('/.well-known/certs').once().reply(500, { boom: true })

    // allow only 1 entry in cache
    const getJwks = buildGetJwks({ providerDiscovery: true, max: 1 })
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
  }
)

describe('allowed domains for discovery', () => {
  test('allows any domain by default for discovery ', async t => {
    const domain = 'https://example.com'

    nock(domain)
      .get('/.well-known/openid-configuration')
      .reply(200, {
        issuer: domain,
        jwks_uri: `${domain}/.well-known/certs`,
      })
    nock(domain).get('/.well-known/certs').reply(200, jwks)
    const getJwks = buildGetJwks({ providerDiscovery: true })

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

  allowedCombinations.forEach(([allowedIssuer, domainFromToken]) => {
    test(
      `allows domain ${allowedIssuer} requested with ${domainFromToken} for discovery`,
      async t => {
        const allowedIssuerSlash = allowedIssuer.endsWith('/')
          ? allowedIssuer
          : `${allowedIssuer}/`
        nock(allowedIssuer)
          .get('/.well-known/openid-configuration')
          .reply(200, {
            issuer: allowedIssuer,
            jwks_uri: `${allowedIssuerSlash}.well-known/certs`,
          })
        nock(allowedIssuer).get('/.well-known/certs').reply(200, jwks)
        const getJwks = buildGetJwks({
          providerDiscovery: true,
          issuersWhitelist: [allowedIssuer],
        })

        const [{ alg, kid }] = jwks.keys

        t.assert.ok(await getJwks.getJwk({ domain: domainFromToken, alg, kid }))
      }
    )
  })

  test('allows multiple domains for discovery', async t => {
    const domain1 = 'https://example1.com'
    const domain2 = 'https://example2.com'
    nock(domain1)
      .get('/.well-known/openid-configuration')
      .reply(200, {
        issuer: domain,
        jwks_uri: `${domain1}/.well-known/certs`,
      })
    nock(domain1).get('/.well-known/certs').reply(200, jwks)
    nock(domain2)
      .get('/.well-known/openid-configuration')
      .reply(200, {
        issuer: domain,
        jwks_uri: `${domain2}/.well-known/certs`,
      })
    nock(domain2).get('/.well-known/certs').reply(200, jwks)

    const getJwks = buildGetJwks({
      providerDiscovery: true,
      issuersWhitelist: [domain1, domain2],
    })

    const [{ alg, kid }] = jwks.keys

    t.assert.ok(await getJwks.getJwk({ domain: domain1, alg, kid }))
    t.assert.ok(await getJwks.getJwk({ domain: domain2, alg, kid }))
  })

  test('forbids domain outside of the allow list', async t => {
    const getJwks = buildGetJwks({
      providerDiscovery: true,
      issuersWhitelist: ['https://example.com/'],
    })

    const [{ alg, kid }] = jwks.keys

    return t.assert.rejects(
      getJwks.getJwk({ domain, alg, kid }),
      new GetJwksError('DOMAIN_NOT_ALLOWED', 'The domain is not allowed.')
    )
  })
})
