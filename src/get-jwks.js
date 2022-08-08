'use strict'

const fetch = require('node-fetch')
const LRU = require('lru-cache')
const jwkToPem = require('jwk-to-pem')

const errors = {
  NO_JWKS_URI: 'No valid jwks_uri key found in providerConfig',
  NO_JWKS: 'No JWKS found in the response.',
  JWK_NOT_FOUND: 'No matching JWK found in the set.',
  DOMAIN_NOT_ALLOWED: 'The domain is not allowed.',
}

function ensureTrailingSlash(domain) {
  return domain.endsWith('/') ? domain : `${domain}/`
}

function ensureNoLeadingSlash(path) {
  return path.startsWith('/') ? path.substring(1) : path
}

function buildGetJwks(options = {}) {
  const max = options.max || 100
  const ttl = options.ttl || 60 * 1000 /* 1 minute */
  const allowedDomains = (options.allowedDomains || []).map(ensureTrailingSlash)
  const providerDiscovery = options.providerDiscovery || false
  const jwksPath = options.jwksPath
    ? ensureNoLeadingSlash(options.jwksPath)
    : false
  const agent = options.agent || null
  const staleCache = new LRU({ max: max * 2, ttl })
  const cache = new LRU({
    max,
    ttl,
    dispose: (value, key) => staleCache.set(key, value),
  })

  async function getJwksUri(normalizedDomain) {
    const response = await fetch(
      `${normalizedDomain}.well-known/openid-configuration`,
      {
        agent,
        timeout: 5000,
      }
    )
    const body = await response.json()

    if (!response.ok) {
      const error = new Error(response.statusText)
      error.response = response
      error.body = body
      throw error
    }

    if (!body.jwks_uri) {
      throw new Error(errors.NO_JWKS_URI)
    }

    return body.jwks_uri
  }

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

        cache.delete(cacheKey)

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
    const jwksUri = jwksPath
      ? normalizedDomain + jwksPath
      : providerDiscovery
      ? await getJwksUri(normalizedDomain)
      : `${normalizedDomain}.well-known/jwks.json`

    const response = await fetch(jwksUri, { agent, timeout: 5000 })
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

    const jwk = body.keys.find(
      key =>
        (alg === undefined || key.alg === undefined || key.alg === alg) &&
        key.kid === kid
    )

    if (!jwk) {
      throw new Error(errors.JWK_NOT_FOUND)
    }

    return jwk
  }

  return {
    getPublicKey,
    getJwk,
    getJwksUri,
    cache,
    staleCache,
  }
}

module.exports = buildGetJwks
