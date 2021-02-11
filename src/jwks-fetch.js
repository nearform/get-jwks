'use strict'

const fetch = require('node-fetch')
const MISSING_KEY_ERROR = 'No matching key found in the set.'
const NO_KEYS_ERROR = 'No keys found in the set.'

async function jwksFetch ({ domain, alg, kid, cache = null }) {
  const cacheKey = `${alg}:${kid}:${domain}`

  const cached = cache ? cache.get(cacheKey) : null

  if (cached) {
    return cached
  } else if (cache && cached === null) {
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
    cache && cache.set(cacheKey, null)
    throw new Error(MISSING_KEY_ERROR)
  }

  // should we be using https://github.com/Brightspace/node-jwk-to-pem ??

  // certToPEM extracted from https://github.com/auth0/node-jwks-rsa/blob/master/src/utils.js
  const secret = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----\n`

  // Save the key in the cache
  cache && cache.set(cacheKey, secret)
  return secret
}

module.exports = jwksFetch
