'use strict'

const { LRUCache } = require('lru-cache')
const jwkToPem = require('jwk-to-pem')

const { errorCode, GetJwksError } = require('./error')

const ONE_MINUTE = 60 * 1000
const FIVE_SECONDS = 5 * 1000

function ensureTrailingSlash(domain) {
  return domain[domain.length - 1] === '/' ? domain : `${domain}/`
}

function ensureNoLeadingSlash(path) {
  return path[0] === '/' ? path.substring(1) : path
}

function buildGetJwks(options = {}) {
  const max = options.max || 100
  const ttl = options.ttl || ONE_MINUTE
  const issuersWhitelist = (options.issuersWhitelist || []).map(ensureTrailingSlash)
  const checkIssuer = options.checkIssuer
  const providerDiscovery = options.providerDiscovery || false
  const jwksPath = options.jwksPath
    ? ensureNoLeadingSlash(options.jwksPath)
    : false
  const fetchOptions = { timeout: FIVE_SECONDS, ...options.fetchOptions }
  const staleCache = new LRUCache({ max: max * 2, ttl })
  const cache = new LRUCache({
    max,
    ttl,
    dispose: (value, key) => staleCache.set(key, value),
  })

  async function getJwksUri(normalizedDomain) {
    const response = await fetch(
      `${normalizedDomain}.well-known/openid-configuration`,
      fetchOptions,
    )
    const body = await response.json()

    if (!response.ok) {
      throw new GetJwksError(errorCode.OPENID_CONFIGURATION_REQUEST_FAILED, {
        response,
        body,
      })
    }

    if (!body.jwks_uri) {
      throw new GetJwksError(errorCode.NO_JWKS_URI)
    }

    return body.jwks_uri
  }

  async function getPublicKey(signature) {
    return jwkToPem(await this.getJwk(signature))
  }

  function getJwk(signature) {
    const { domain, alg, kid } = signature

    const normalizedDomain = ensureTrailingSlash(domain)

    if (issuersWhitelist.length && !issuersWhitelist.includes(normalizedDomain)) {
      const error = new GetJwksError(errorCode.DOMAIN_NOT_ALLOWED)
      return Promise.reject(error)
    }

    if (checkIssuer && !checkIssuer(normalizedDomain)) {
      const error = new GetJwksError(errorCode.DOMAIN_NOT_ALLOWED)
      return Promise.reject(error)
    }

    const cacheKey = `${alg}:${kid}:${normalizedDomain}`
    const cachedJwk = cache.get(cacheKey)

    if (cachedJwk) {
      return cachedJwk
    }

    const jwkPromise = retrieveJwk(normalizedDomain, alg, kid).catch(
      err => {
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

    const response = await fetch(jwksUri, fetchOptions)
    const body = await response.json()

    if (!response.ok) {
      throw new GetJwksError(errorCode.JWKS_REQUEST_FAILED, {
        response,
        body,
      })
    }

    if (!body.keys?.length) {
      throw new GetJwksError(errorCode.NO_JWKS)
    }

    const jwk = body.keys.find(
      key =>
        (alg === undefined || key.alg === undefined || key.alg === alg) &&
        key.kid === kid
    )

    if (!jwk) {
      throw new GetJwksError(errorCode.JWK_NOT_FOUND)
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
