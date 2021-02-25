'use strict'

const t = require('tap')

const buildGetJwks = require('../src/get-jwks')

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

t.test('if there is already a key in cache, it should not make a http request', async t => {
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid

  getJwks.cache.set(`${alg}:${kid}:${domain}`, localKey)

  try {
    const secret = await getJwks.getSecret({ domain, alg, kid })
    const key = await getJwks.getSecret({ domain, alg, kid })
    t.ok(secret)
    t.ok(key)
  } catch (e) {
    t.throws(e)
  }
})

t.test('if initialized without any cache settings it should use default values', async t => {
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const cache = getJwks.cache
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  cache.set(`${alg}:${kid}:${domain}`, localKey)
  const secret = await getJwks.getSecret({ domain, alg, kid })
  const key = await getJwks.getKey({ domain, alg, kid })
  t.ok(secret)
  t.ok(key)
  t.ok(getJwks.cache)
  t.equal(cache.max, 100)
  t.equal(cache.ttl, 60000)
})

t.test('calling the clear cache function resets the cache and clears keys', async t => {
  const getJwks = buildGetJwks()
  const domain = 'https://localhost/'
  const localKey = jwks.keys[0]
  const alg = localKey.alg
  const kid = localKey.kid
  const cache = getJwks.cache
  cache.set(`${alg}:${kid}:${domain}`, localKey)
  const secret = await getJwks.getSecret({ domain, alg, kid })
  const key = await getJwks.getKey({ domain, alg, kid })
  t.ok(secret)
  t.ok(key)
  t.equal(cache.get(`${alg}:${kid}:${domain}`), localKey)
  await getJwks.clearCache()
  t.equal(cache.get(`${alg}:${kid}:${domain}`), undefined)
})
