'use strict'

const fetch = require('node-fetch')
const lru = require('tiny-lru')
const jwkToPem = require('jwk-to-pem')

const MISSING_KEY_ERROR = 'No matching key found in the set.'
const NO_KEYS_ERROR = 'No keys found in the set.'

function buildGetJwks (cacheProps = {}) {
  const max = cacheProps.max || 100
  const ttl = cacheProps.ttl || 60 * 1000
  const cache = lru(max, ttl)

  async function getSecret (signatures) {
    const { domain, alg, kid } = signatures
    const cacheKey = `${alg}:${kid}:${domain}`
    const cachedSecret = cache.get(cacheKey)

    if (cachedSecret) {
      return cachedSecret
    } else if (cachedSecret === null) {
      // null is returned when a previous attempt resulted in the key missing in the JWKs - Do not attemp to fetch again
      throw new Error(MISSING_KEY_ERROR)
    }

    // ensure there's a trailing slash from the domain
    const issuerDomain = domain.endsWith('/') ? domain : `${ domain }/`

    // Hit the well-known URL in order to get the key
    const response = await fetch(`${ issuerDomain }.well-known/jwks.json`, { timeout: 5000 })
    const body = await response.json()

    if (!response.ok) {
      const error = new Error(response.statusText)
      error.response = response
      error.body = body

      throw error
    }

    if (!body.keys || body.keys.length === 0) {
      throw new Error(NO_KEYS_ERROR)
    }

    // Find the key with ID and algorithm matching the JWT token header
    const key = body.keys.find(k => k.alg === alg && k.kid === kid)

    if (!key) {
      // Mark the key as missing
      cache.set(cacheKey, null)
      throw new Error(MISSING_KEY_ERROR)
    }

    const secret = jwkToPem(key)

    // Save the key in the cache
    cache.set(cacheKey, secret)
    return secret
  }

  return {
    getSecret,
    clearCache: () => cache.clear(),
    cache
  }
}

module.exports = buildGetJwks
