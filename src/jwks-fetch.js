'use strict'

const fetch = require('node-fetch')
const lru = require('tiny-lru')

const MISSING_KEY_ERROR = 'No matching key found in the set.'
const NO_KEYS_ERROR = 'No keys found in the set.'

function buildJwksFetch (cacheProps = {}) {
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

    // Hit the well-known URL in order to get the key
    const response = await fetch(`${domain}.well-known/jwks.json`, { timeout: 5000 })
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

    // should we be using https://github.com/Brightspace/node-jwk-to-pem ??

    // certToPEM extracted from https://github.com/auth0/node-jwks-rsa/blob/master/src/utils.js
    const secret = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----\n`

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

module.exports = buildJwksFetch
