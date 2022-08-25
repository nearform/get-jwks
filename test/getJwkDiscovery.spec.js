'use strict'

const nock = require('nock')
const t = require('tap')

const { oidcConfig, jwks, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')
const { errorCode, GetJwksError } = require('../src/error')

t.beforeEach(async () => {
  nock.disableNetConnect()
})

t.afterEach(async () => {
  nock.cleanAll()
  nock.enableNetConnect()
})

t.test('rejects if the discovery request fails', async t => {
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
  await t.rejects(getJwks.getJwk({ domain, alg, kid }), expectedError)
})

t.test('rejects if the request fails', async t => {
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

  await t.rejects(getJwks.getJwk({ domain, alg, kid }), expectedError)
})

t.test('returns a jwk if alg and kid match for discovery', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const key = jwks.keys[0]

  const jwk = await getJwks.getJwk({ domain, alg: key.alg, kid: key.kid })

  t.ok(jwk)
  t.same(jwk, key)
})

t.test(
  'returns a jwk if no alg is provided and kid match for discovery',
  async t => {
    nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
    nock(domain).get('/.well-known/certs').reply(200, jwks)
    const getJwks = buildGetJwks({ providerDiscovery: true })
    const key = jwks.keys[2]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })

    t.ok(jwk)
    t.same(jwk, key)
  }
)

t.test(
  'returns a jwk if no alg is provided and kid match for discovery but jwk has alg',
  async t => {
    nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
    nock(domain).get('/.well-known/certs').reply(200, jwks)
    const getJwks = buildGetJwks({ providerDiscovery: true })
    const key = jwks.keys[1]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })

    t.ok(jwk)
    t.same(jwk, key)
  }
)

t.test('caches a successful response for discovery', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)

  const getJwks = buildGetJwks({ providerDiscovery: true })
  const key = jwks.keys[0]
  const { alg, kid } = key

  await getJwks.getJwk({ domain, alg, kid })
  const jwk = await getJwks.getJwk({ domain, alg, kid })

  t.ok(jwk)
  t.same(jwk, key)
})

t.test('does not cache a failed response for discovery', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .twice()
    .reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(500, { msg: 'boom' })
  nock(domain).get('/.well-known/certs').reply(200, jwks)

  const [{ alg, kid }] = jwks.keys
  const getJwks = buildGetJwks({ providerDiscovery: true })

  await t.rejects(getJwks.getJwk({ domain, alg, kid }))
  await t.resolves(getJwks.getJwk({ domain, alg, kid }))
})

t.test('rejects if response is an empty object for discovery', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, {})
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    'No JWKS found in the response.'
  )
})

t.test('rejects if no JWKS are found in the response', async t => {
  nock(domain).get('/.well-known/openid-configuration').reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, { keys: [] })
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  return t.rejects(
    getJwks.getJwk({ domain, alg, kid }),
    'No JWKS found in the response.'
  )
})

t.test('supports domain without trailing slash for discovery', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .once()
    .reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)
  const getJwks = buildGetJwks({ providerDiscovery: true })
  const [{ alg, kid }] = jwks.keys

  const key = await getJwks.getJwk({ domain: 'https://localhost', alg, kid })
  t.ok(key)
})

t.test('does not execute concurrent requests for discovery', () => {
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

t.test(
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

    t.strictSame(key, key1)
  }
)

t.test('allowed domains for discovery', async t => {
  t.test('allows any domain by default for discovery ', async t => {
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
      `allows domain ${allowedDomain} requested with ${domainFromToken} for discovery`,
      async t => {
        const allowedDomainSlash = allowedDomain.endsWith('/')
          ? allowedDomain
          : `${allowedDomain}/`
        nock(allowedDomain)
          .get('/.well-known/openid-configuration')
          .reply(200, {
            issuer: allowedDomain,
            jwks_uri: `${allowedDomainSlash}.well-known/certs`,
          })
        nock(allowedDomain).get('/.well-known/certs').reply(200, jwks)
        const getJwks = buildGetJwks({
          providerDiscovery: true,
          allowedDomains: [allowedDomain],
        })

        const [{ alg, kid }] = jwks.keys

        t.ok(await getJwks.getJwk({ domain: domainFromToken, alg, kid }))
      }
    )
  })

  t.test('allows multiple domains for discovery', async t => {
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
      allowedDomains: [domain1, domain2],
    })

    const [{ alg, kid }] = jwks.keys

    t.ok(await getJwks.getJwk({ domain: domain1, alg, kid }))
    t.ok(await getJwks.getJwk({ domain: domain2, alg, kid }))
  })

  t.test('forbids domain outside of the allow list', async t => {
    const getJwks = buildGetJwks({
      providerDiscovery: true,
      allowedDomains: ['https://example.com/'],
    })

    const [{ alg, kid }] = jwks.keys

    return t.rejects(
      getJwks.getJwk({ domain, alg, kid }),
      'The domain is not allowed.'
    )
  })
})
