'use strict'

const t = require('tap')
const nock = require('nock')
const jwkToPem = require('jwk-to-pem')

const { jwks, domain } = require('./constants')

const buildGetJwks = require('../src/get-jwks')

t.test(
  'if there is already a key in cache, it should not make a http request',
  async t => {
    const getJwks = buildGetJwks()
    const localKey = jwks.keys[0]
    const alg = localKey.alg
    const kid = localKey.kid

    getJwks.cache.set(`${alg}:${kid}:${domain}`, Promise.resolve(localKey))

    const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
    const jwk = await getJwks.getJwk({ domain, alg, kid })
    t.ok(publicKey)
    t.ok(jwk)
    t.equal(publicKey, jwkToPem(jwk))
    t.same(jwk, localKey)
  }
)

t.test(
  'if initialized without any cache settings it should use default values',
  async t => {
    nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
    const getJwks = buildGetJwks()
    const cache = getJwks.cache
    const [{ alg, kid }] = jwks.keys
    const publicKey = await getJwks.getPublicKey({ domain, alg, kid })
    const jwk = await getJwks.getJwk({ domain, alg, kid })

    t.ok(publicKey)
    t.ok(jwk)
    t.ok(getJwks.cache)
    t.equal(cache.max, 100)
    t.equal(cache.ttl, 60000)
  }
)
