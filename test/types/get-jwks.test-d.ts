import { expectAssignable } from 'tsd'
import Cache from '../../src/cache'
import buildGetJwks, { GetPublicKeyOptions, JWK, JWKSignature } from '../../src/get-jwks'

const { getPublicKey, getJwk, getJwksUri, cache, staleCache } = buildGetJwks()

expectAssignable<(signature: JWKSignature) => Promise<JWK>>(getJwk)
expectAssignable<(normalizedDomain: string) => Promise<string>>(getJwksUri)
expectAssignable<(options?: GetPublicKeyOptions) => Promise<string>>(getPublicKey)
expectAssignable<Cache<string, JWK>>(cache)
expectAssignable<Cache<string, JWK>>(staleCache)
