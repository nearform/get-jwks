'use strict'

const fetch = require('node-fetch')
const LRU = require('lru-cache')
const jwkToPem = require('jwk-to-pem')

const errors = {
  NO_JWKS: 'No JWKS found in the response.',
  JWK_NOT_FOUND: 'No matching JWK found in the set.',
  DOMAIN_NOT_ALLOWED: 'The domain is not allowed.',
}

function ensureTrailingSlash(domain) {
  return domain.endsWith('/') ? domain : `${domain}/`
}

function buildGetJwks(options = {}) {
  const max = options.max || 100
  const maxAge = options.maxAge || 60 * 1000 /* 1 minute */
  const allowedDomains = (options.allowedDomains || []).map(ensureTrailingSlash)

  const staleCache = new LRU({ max: max * 2, maxAge })
  const cache = new LRU({
    max,
    maxAge,
    dispose: staleCache.set.bind(staleCache),
  })

  async function getPublicKey(signature) {
    return jwkToPem(await this.getJwk(signature))
  }

  function getJwk(signature) {
    const { domain, alg, kid } = signature
    const normalizedDomain = ensureTrailingSlash(domain)

    if (allowedDomains.length && !allowedDomains.includes(normalizedDomain)) {
      return Promise.reject(new Error(errors.DOMAIN_NOT_ALLOWED))
    }

    const cacheKey = `${alg}:${kid}:${normalizedDomain}`
    const cachedJwk = cache.get(cacheKey)

    if (cachedJwk) {
      return cachedJwk
    }

    const jwkPromise = retrieveJwk(normalizedDomain, alg, kid).catch(
      async err => {
        const stale = staleCache.get(cacheKey)

        cache.del(cacheKey)

        if (stale) {
          return stale
        }

        throw err
      }
    )

    cache.set(cacheKey, jwkPromise)

    return jwkPromise
  }

  async function retrieveJwk(normalizedDomain, alg, kid) {
    const response = await fetch(`${normalizedDomain}.well-known/jwks.json`, {
      timeout: 5000,
    })
    const body = await response.json()

    if (!response.ok) {
      const error = new Error(response.statusText)
      error.response = response
      error.body = body
      throw error
    }

    if (!body.keys || body.keys.length === 0) {
      throw new Error(errors.NO_JWKS)
    }

    const jwk = body.keys.find(key => key.alg === alg && key.kid === kid)

    if (!jwk) {
      throw new Error(errors.JWK_NOT_FOUND)
    }

    return jwk
  }

  return {
    getPublicKey,
    getJwk,
    cache,
    staleCache,
  }
}

module.exports = buildGetJwks
