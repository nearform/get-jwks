import { expectAssignable } from 'tsd'
import type { LRUCache } from 'lru-cache'
import buildGetJwks, { GetPublicKeyOptions, JWK, JWKSignature } from '../../src/get-jwks'

const { getPublicKey, getJwk, getJwksUri, cache, staleCache } = buildGetJwks()

expectAssignable<(signature: JWKSignature) => Promise<JWK>>(getJwk)
expectAssignable<(normalizedDomain: string) => Promise<string>>(getJwksUri)
expectAssignable<(options?: GetPublicKeyOptions) => Promise<string>>(getPublicKey)
expectAssignable<LRUCache<string, JWK>>(cache)
expectAssignable<LRUCache<string, JWK>>(staleCache)
