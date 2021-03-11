'use strict'

const fetch = require('node-fetch')
const lru = require('tiny-lru')
const jwkToPem = require('jwk-to-pem')

const MISSING_JWK_ERROR = 'No matching JWK found in the set.'
const NO_JWKS_ERROR = 'No JWKS found in the response.'

function buildGetJwks (cacheProps = {}) {
  const max = cacheProps.max || 100
  const ttl = cacheProps.ttl || 60 * 1000
  const cache = lru(max, ttl)

  async function getPublicKey (signatures) {
    const key = await getJwk(signatures)
    const publicKey = jwkToPem(key)
    return publicKey
  }

  async function getJwk (signatures) {
    const { domain, alg, kid } = signatures
    const cacheKey = `${alg}:${kid}:${domain}`
    const cachedJwk = cache.get(cacheKey)

    if (cachedJwk) {
      return cachedJwk
    }

    const issuerDomain = domain.endsWith('/') ? domain : `${domain}/`
    const response = await fetch(`${issuerDomain}.well-known/jwks.json`, { timeout: 5000 })
    const body = await response.json()

    if (!response.ok) {
      const error = new Error(response.statusText)
      error.response = response
      error.body = body
      throw error
    }

    if (!body.keys || body.keys.length === 0) {
      throw new Error(NO_JWKS_ERROR)
    }

    const jwk = body.keys.find(k => k.alg === alg && k.kid === kid)

    if (!jwk) {
      throw new Error(MISSING_JWK_ERROR)
    }

    cache.set(cacheKey, jwk)
    return jwk
  }

  return {
    getPublicKey,
    getJwk,
    clearCache: () => cache.clear(),
    cache
  }
}

module.exports = buildGetJwks
