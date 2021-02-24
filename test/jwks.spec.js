'use strict'

const nock = require('nock')
const t = require('tap')
const jwkToPem = require('jwk-to-pem')

const buildGetJwks = require('../src/get-jwks')

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
  nock('https://localhost/').get('/.well-known/jwks.json').reply(500, { msg: 'no good' })
  try {
    const getJwks = buildGetJwks()
    await getJwks.getSecret({ domain: 'https://localhost/', alg: 'RS512', kid: 'KEY_0' })
  } catch (e) {
    t.equal(e.message, 'Internal Server Error')
    t.same(e.body, { msg: 'no good' })
  }
})

t.test('should fetch the remove jwks and return an error if alg and kid do not match', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  try {
    const getJwks = buildGetJwks()
    await getJwks.getSecret({ domain: 'https://localhost/', alg: 'ABC', kid: 'some other KEY' })
  } catch (e) {
    t.equal(e.message, 'No matching key found in the set.')
  }
})

t.test('should fetch the jwks and return a secret if alg and kid match', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const secret = await getJwks.getSecret({ domain: 'https://localhost/', alg: localKey.alg, kid: localKey.kid })
  const pem = jwkToPem(jwks.keys[0])
  t.ok(secret)
  t.equal(secret, pem)
})

t.test('if the cached key is null it should return an error', async t => {
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const alg = 'ABC'
  const kid = 'key'
  const cache = getJwks.cache
  cache.set(`${alg}:${kid}:${domain}`, null)

  try {
    await getJwks.getSecret({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No matching key found in the set.')
  }
})

t.test('if alg and kid do not match any jwks, the cache key should be set to null', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const alg = 'ALG'
  const kid = 'KEY'
  const cache = getJwks.cache

  try {
    await getJwks.getSecret({ domain, alg, kid, cache })
  } catch (e) {
    t.equal(e.message, 'No matching key found in the set.')
  }

  t.equal(cache.get(`${alg}:${kid}:${domain}`), null)
})

t.test('if the cached key is undefined it should fetch the jwks and set the key to the secret', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[1]
  const alg = localKey.alg
  const kid = localKey.kid
  const cache = getJwks.cache

  const secret = await getJwks.getSecret({ domain, alg, kid })
  const pem = jwkToPem(localKey)
  t.ok(secret)
  t.equal(secret, pem)
  t.equal(cache.get(`${alg}:${kid}:${domain}`), secret)
})

t.test('if the cached key has a value it should return that value', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const cache = getJwks.cache
  cache.set(`${alg}:${kid}:${domain}`, 'super secret')

  const secret = await getJwks.getSecret({ domain, alg, kid, cache })
  t.ok(secret)
  t.includes(secret, 'super secret')
  t.equal(cache.get(`${alg}:${kid}:${domain}`), 'super secret')
})

t.test('it will throw an error id no keys are found in the JWKS', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksNoKeys)
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid

  try {
    const getJwks = buildGetJwks()
    await getJwks.getSecret({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No keys found in the set.')
  }
})

t.test('it will throw an error id no keys are found in the JWKS', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwksEmptyKeys)
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid

  try {
    const getJwks = buildGetJwks()
    await getJwks.getSecret({ domain, alg, kid })
  } catch (e) {
    t.equal(e.message, 'No keys found in the set.')
  }
})

t.test('if initialized without any cache settings it should use default values', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)

  const getJwks = buildGetJwks()
  const cache = getJwks.cache

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
  const secret = await getJwks.getSecret({ domain, alg, kid })

  t.ok(secret)
  t.equal(cache.get(`${alg}:${kid}:${domain}`), secret)
  await getJwks.clearCache()
  t.equal(cache.get(`${alg}:${kid}:${domain}`), undefined)
})

t.test('if an issuer provides a domain where there is a missing trailing slash, it should be handled', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const domainWithMissingTrailingSlash = 'https://localhost'
  const getJwks = buildGetJwks()
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const secret = await getJwks.getSecret({ domain: domainWithMissingTrailingSlash, alg, kid })
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
      kid: 'KEY',
      e: 'AQAB',
      kty: 'RSA',
      n: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvZSBCbG9nZ3MiLCJhZG1pbiI6dHJ1ZSwianRpIjoiZmYxMGYxODUtYWI4MS00OGNhLWFmYjUtN2RjYWEzM2ZjODM1IiwiaWF0IjoxNjE0MTAzOTE2LCJleHAiOjE2MTQxMDc1NDl9.4PQiX1jCDiTbRnwWusQHW2UNHxpGgpcRaUxSt4K6C8I',
      use: 'sig',
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
