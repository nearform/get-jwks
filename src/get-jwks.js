'use strict'

const fetch = require('node-fetch')
const lru = require('tiny-lru')
const jwkToPem = require('jwk-to-pem')

const errors = {
  NO_JWKS: 'No JWKS found in the response.',
  JWK_NOT_FOUND: 'No matching JWK found in the set.',
  DOMAIN_NOT_ALLOWED: 'The domain is not allowed.'
}

function ensureTrailingSlash (domain) {
  return domain.endsWith('/') ? domain : `${domain}/`
}

function buildGetJwks (options = {}) {
  const max = options.max || 100
  const ttl = options.ttl || 60 * 1000
  const allowedDomains = (options.allowedDomains || []).map(ensureTrailingSlash)

  const cache = lru(max, ttl)

  async function getPublicKey (signature) {
    return jwkToPem(await this.getJwk(signature))
  }

  async function getJwk (signature) {
    const { domain, alg, kid } = signature
    const normalizedDomain = ensureTrailingSlash(domain)

    if (allowedDomains.length && !allowedDomains.includes(normalizedDomain)) {
      throw new Error(errors.DOMAIN_NOT_ALLOWED)
    }

    const cacheKey = `${alg}:${kid}:${normalizedDomain}`
    const cachedJwk = cache.get(cacheKey)

    if (cachedJwk) {
      return cachedJwk
    }

    const jwkPromise = retrieveJwk(normalizedDomain, alg, kid)

    cache.set(cacheKey, jwkPromise)

    return jwkPromise
  }

  async function retrieveJwk (domain, alg, kid) {
    const response = await fetch(`${domain}.well-known/jwks.json`, { timeout: 5000 })
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
    clearCache: () => cache.clear(),
    cache
  }
}

module.exports = buildGetJwks
