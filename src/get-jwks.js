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
    const cachedJwsk = cache.get(cacheKey)

    if (cachedJwsk) {
      const secret = jwkToPem(cachedJwsk)
      return secret
    }

    const key = await getKey(signatures)
    const secret = jwkToPem(key)
    cache.set(cacheKey, secret)
    return secret
  }

  async function getKey (signatures) {
    const { domain, alg, kid } = signatures
    const cacheKey = `${alg}:${kid}:${domain}`
    const cachedJwsk = cache.get(cacheKey)

    if (cachedJwsk) {
      return cachedJwsk
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
      throw new Error(NO_KEYS_ERROR)
    }

    const key = body.keys.find(k => k.alg === alg && k.kid === kid)

    if (!key) {
      throw new Error(MISSING_KEY_ERROR)
    }

    cache.set(cacheKey, key)
    return key
  }

  return {
    getSecret,
    getKey,
    clearCache: () => cache.clear(),
    cache
  }
}

module.exports = buildGetJwks
