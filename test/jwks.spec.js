'use strict'

const nock = require('nock')
const t = require('tap')

const buildJwksFetch = require('../src/jwks-fetch')

t.beforeEach((done, t) => {
  nock.disableNetConnect()
  done()
})

t.afterEach((done, t) => {
  nock.cleanAll()
  nock.enableNetConnect()
  done()
})

t.test('should fetch the remove jwks and return an error if the request fails', async t => {
  t.plan(2)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(500, { msg: 'no good' })
  try {
    const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
    await jwksFetch.getSecret({ domain: 'https://localhost/', alg: 'RS512', kid: 'KEY' })
  } catch (e) {
    t.equal(e.message, 'Internal Server Error')
    t.same(e.body, { msg: 'no good' })
  }
  t.end()
})

t.test('should fetch the remove jwks and return an error if alg and kid do not match', async t => {
  t.plan(1)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  try {
    const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
    await jwksFetch.getSecret({ domain: 'https://localhost/', alg: 'ABC', kid: 'some other KEY' })
  } catch (e) {
    t.equal(e.message, 'No matching key found in the set.')
  }
  t.end()
})

t.test('should fetch the remove jwks and return an the secrete if alg and kid match', async t => {
  t.plan(2)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
  const secret = await jwksFetch.getSecret({ domain: 'https://localhost/', alg: 'RS512', kid: 'KEY' })
  t.ok(secret)
  t.includes(secret, jwks.keys[0].x5c[0])
  t.end()
})

t.test('if the cached key is null it would return an error', async t => {
  t.plan(1)

  const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
  const domain = 'https://localhost/'
  const alg = 'ABC'
  const kid = 'key'
  const cache = jwksFetch.cache
  cache.set(`${alg}:${kid}:${domain}`, null)

  try {
    await jwksFetch.getSecret({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No matching key found in the set.')
  }
  t.end()
})

t.test('if alg and kid do not match any jwks, the cache key should be set to null', async t => {
  t.plan(2)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)

  const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
  const domain = 'https://localhost/'
  const alg = 'ALG'
  const kid = 'KEY'
  const cache = jwksFetch.cache

  try {
    await jwksFetch.getSecret({ domain, alg, kid, cache })
  } catch (e) {
    t.equal(e.message, 'No matching key found in the set.')
  }

  t.equal(cache.get(`${alg}:${kid}:${domain}`), null)
  t.end()
})

t.test('if the cached key is undefined it should fetch the jwks and set the key to the secret', async t => {
  t.plan(3)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
  const domain = 'https://localhost/'
  const alg = 'RS512'
  const kid = 'KEY'
  const cache = jwksFetch.cache

  const secret = await jwksFetch.getSecret({ domain, alg, kid })
  t.ok(secret)
  t.includes(secret, jwks.keys[0].x5c[0])
  t.equal(cache.get(`${alg}:${kid}:${domain}`), secret)
  t.end()
})

t.test('if the cached key has a value it should return that value', async t => {
  t.plan(3)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
  const domain = 'https://localhost/'
  const alg = 'RS512'
  const kid = 'KEY'
  const cache = jwksFetch.cache
  cache.set(`${alg}:${kid}:${domain}`, 'super secret')

  const secret = await jwksFetch.getSecret({ domain, alg, kid, cache })
  t.ok(secret)
  t.includes(secret, 'super secret')
  t.equal(cache.get(`${alg}:${kid}:${domain}`), 'super secret')
  t.end()
})

t.test('it will throw an error id no keys are found in the JWKS', async t => {
  t.plan(1)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksNoKeys)
  const domain = 'https://localhost/'
  const alg = 'RS512'
  const kid = 'KEY'

  try {
    const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
    await jwksFetch.getSecret({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No keys found in the set.')
  }

  t.end()
})

t.test('it will throw an error id no keys are found in the JWKS', async t => {
  t.plan(1)
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksEmptyKeys)
  const domain = 'https://localhost/'
  const alg = 'RS512'
  const kid = 'KEY'

  try {
    const jwksFetch = buildJwksFetch({ max: 100, ttl: 60 * 1000 })
    await jwksFetch.getSecret({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No keys found in the set.')
  }

  t.end()
})

const jwks = {
  keys: [
    {
      alg: 'RS512',
      kid: 'KEY',
      x5c: ['UNUSED']
    },
    {
      alg: 'RS256',
      kid: 'KEY',
      x5c: [
        `
MIIEnjCCAoYCCQCMoDmTYrlYFTANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZ1
bnVzZWQwHhcNMTkxMTEyMTIzMjI0WhcNMTkxMjEyMTIzMjI0WjARMQ8wDQYDVQQD
DAZ1bnVzZWQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDK7ys6lJMZ
X5kt7NfsJHKHA7QXxmoixVw2lEPuyY/n4wg73+9IcyHmWUseb1AGHyXN1dD6GkcI
ujuFJdrzdsNuFsCQDB7YE0/ZH9sqBAp6A8qh42ZAG/A8VkMGkMzSypvEcinJ7USO
zYv9Q3BqKEAX41uE5dMRMVNQDEcHGxhoLwGpHECJgQ2NrRFK92WQvUuyJdoVF1hG
WXSWAGfTZUHLpG3FTK3175we8qBsqynkvegAOwzETLdExWt620dRl7gRp6hDfECH
69tdH6Qn1FC6fBKc1zvh79NA1iJrDCNJDFzN1bGVduPgOzsorhZSpt/ESw5YEOvC
QAHOtzNmVa+4SOOm/2eDs5X066YmmRGv9aNC5humBPwfKFdIJbhCeP6XBaG2vtSx
wfFEyfNCKoUTPUqdmj/CTW/TEFuzFab1hRLTmwOuLe2x3B0DuAkd/+auifXwDDPN
GVs+VySqWeu00hSVEzKZ9FdU0abGkmRqytj7xw8gPJ+jroq5ZFAyPtPUf8IpSubX
qAl0ppsqMrn9aMEEsu+APJi8yK4pEppWVZZBqf4/iPA+rR2J9uarUIsTQY8SKAeG
BpcOTEjXvW5nTLmAE2hse39qrT5xWp/PXxmsMR6Q3Dn/drlySoNlCGIi4L+BfS+Q
VZfm9BxIqS/aQW5TRMpeT7QAeK6NXD3dDwIDAQABMA0GCSqGSIb3DQEBCwUAA4IC
AQCEwcGqCjW0FDrRepfglTLLk699SjidT8+DvnXEwhN85PFT4U0ArEe5n3Cb6ray
qPEeOVG6QjLtGUZ9PRGVAjttfDQTAEWjqzJoqyAl60jj9Tm/G65UUbfHx37+Bvbc
jlQ1FqZ4Jr4b14uFOONh0WH92VRDR47k/WWaP5bjxbyCIGcGzohh2XyrtOtDU+hV
BntQ0w7736bL/MSunXO8tkx+LyM/Z4+HSWiwI+fcdIib27ZVFQ3W1NnRoufsSUqo
Noi2XJqr1oLbSGpagLiXsIr8UufOrpZ92Pool0/B4y/d6GbbK2UjxyHjGKB8fwNi
nU/+KAI1jPJT9dSc18u6F+cz4lQkGA9hmvApmiR7tTdcBWK/+m1lOHj4H8kZ2P/H
fZuOj1+GtJ+JTZO35d+GPJ41NVLDAm5gc3kGkDPt+XRZZLAtafPhMGK7jUzEgyLI
MITSqxjlBT++5VV035m84N+j5XJ0rYEHvgOmWJpJN+q/nIJpidq/6HzLOLoqmM5D
UGiOoOTZIj3/OfyolcYztNb+rYe3Ch/KbReC/h1sU/xqLJCImDyhHwSarjDdi8A3
dWxawCwETuA17mD7o/hsRUbXM6DHZekkuWPOL25UpRzlA1dtXMQ2ac83k+U6wyRs
7jYWkrpLCTpEJcQ0uGEQnsTsjr2oCq/KvNmDki+iMtvjhA==
        `.trim()
      ]
    }
  ]
}

const jwksNoKeys = {}
const jwksEmptyKeys = { keys: [] }
